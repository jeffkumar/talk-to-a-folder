import { put } from "@vercel/blob";
import {
  createProjectDoc,
  getProjectDocByGoogleFileId,
  markProjectDocIndexError,
  markProjectDocIndexed,
  updateProjectDoc,
  upsertInvoiceForDocument,
} from "@/lib/db/queries";
import type { Project } from "@/lib/db/schema";
import {
  ingestDocSummaryToTurbopuffer,
  ingestUploadedDocToTurbopuffer,
} from "@/lib/ingest/docs";
import { parseStructuredProjectDoc } from "@/lib/ingest/parse-structured-document";
import {
  downloadGoogleDriveFile,
  driveJson,
  isSupportedMimeType,
} from "@/lib/integrations/google/drive";
import { deleteByFilterFromTurbopuffer } from "@/lib/rag/turbopuffer";

type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  modifiedTime?: string;
  parents?: string[];
};

export type GoogleSyncResult =
  | { fileId: string; status: "synced"; docId: string; filename: string }
  | { fileId: string; status: "skipped"; reason: string }
  | { fileId: string; status: "failed"; error: string };

type InFlightLock = { startedAtMs: number };

const inFlightSyncLocks = new Map<string, InFlightLock>();
const IN_FLIGHT_LOCK_TTL_MS = 10 * 60 * 1000;

function isVercelBlobUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function tryAcquireSyncLock(key: string) {
  const existing = inFlightSyncLocks.get(key);
  const now = Date.now();
  if (existing && now - existing.startedAtMs < IN_FLIGHT_LOCK_TTL_MS) {
    return false;
  }
  inFlightSyncLocks.set(key, { startedAtMs: now });
  return true;
}

function releaseSyncLock(key: string) {
  inFlightSyncLocks.delete(key);
}

function getDocsNamespace(isDefaultProject: boolean, projectId: string) {
  return isDefaultProject ? "_synergy_docsv2" : `_synergy_${projectId}_docsv2`;
}

// Google Docs mimeTypes that need export
const GOOGLE_DOCS_EXPORT_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation": "application/pdf",
};

function isGoogleDocsType(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.");
}

function getSupportedMimeTypeForGoogleFile(
  originalMimeType: string
): string | null {
  // If it's a Google Docs type, return the export format
  if (GOOGLE_DOCS_EXPORT_TYPES[originalMimeType]) {
    return GOOGLE_DOCS_EXPORT_TYPES[originalMimeType];
  }
  // If it's already a supported mime type, return it
  if (isSupportedMimeType(originalMimeType)) {
    return originalMimeType;
  }
  // Unsupported
  return null;
}

export async function syncGoogleDriveItemsToProjectDocs({
  userId,
  project,
  items,
  documentType,
  entityName,
  entityKind,
  invoiceSender,
  invoiceRecipient,
  workflowAgentId,
}: {
  userId: string;
  project: Project;
  items: Array<{ fileId: string; filename: string }>;
  documentType?: "general_doc" | "bank_statement" | "cc_statement" | "invoice";
  entityName?: string;
  entityKind?: "personal" | "business";
  invoiceSender?: string;
  invoiceRecipient?: string;
  workflowAgentId?: string;
}): Promise<GoogleSyncResult[]> {
  const namespace = getDocsNamespace(project.isDefault, project.id);
  const effectiveDocumentType = documentType ?? "general_doc";

  const processItem = async ({
    fileId,
    filename,
  }: {
    fileId: string;
    filename: string;
  }): Promise<GoogleSyncResult> => {
    const lockKey = `${project.id}:google:${fileId}`;
    const acquired = tryAcquireSyncLock(lockKey);
    if (!acquired) {
      return { fileId, status: "skipped", reason: "Already syncing" };
    }

    try {
      // 1. Fetch metadata
      const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink,modifiedTime,parents`;
      const meta = await driveJson<DriveFileMeta>(userId, metaUrl);

      const sizeBytes =
        meta.size && Number.isFinite(Number.parseInt(meta.size, 10))
          ? Number.parseInt(meta.size, 10)
          : null;
      const originalMimeType = meta.mimeType;
      const modifiedTime = meta.modifiedTime;
      const sourceWebUrl = meta.webViewLink ?? null;
      const googleParentIds = meta.parents ?? [];

      // Check if this file type is supported
      const effectiveMimeType =
        getSupportedMimeTypeForGoogleFile(originalMimeType);
      if (!effectiveMimeType) {
        return {
          fileId,
          status: "skipped",
          reason: `Unsupported file type: ${originalMimeType}`,
        };
      }

      // Size check (skip for Google Docs types which have no size)
      if (sizeBytes !== null && sizeBytes > 100 * 1024 * 1024) {
        return {
          fileId,
          status: "skipped",
          reason: "File too large (max 100MB)",
        };
      }

      // 2. Download content
      let content: Buffer;
      let finalMimeType: string;

      try {
        const downloaded = await downloadGoogleDriveFile({ userId, fileId });
        content = downloaded.content;
        finalMimeType = downloaded.mimeType;
      } catch (error) {
        return {
          fileId,
          status: "failed",
          error: error instanceof Error ? error.message : "Download failed",
        };
      }

      // 3. Upload to Blob Storage
      let blobUrl: string | null = null;
      // Adjust filename extension for exported Google Docs
      let adjustedFilename = filename;
      if (isGoogleDocsType(originalMimeType)) {
        if (finalMimeType === "application/pdf" && !filename.endsWith(".pdf")) {
          adjustedFilename = filename.replace(/\.[^.]+$/, "") + ".pdf";
        } else if (
          finalMimeType ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
          !filename.endsWith(".xlsx")
        ) {
          adjustedFilename = filename.replace(/\.[^.]+$/, "") + ".xlsx";
        }
      }

      try {
        const blob = await put(adjustedFilename, content, {
          access: "public",
          contentType: finalMimeType,
        });
        blobUrl = blob.url;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Blob upload failed";
        console.error("Blob upload failed:", message);
      }

      // 4. Update or Create ProjectDoc
      let doc = await getProjectDocByGoogleFileId({
        projectId: project.id,
        googleFileId: fileId,
      });

      if (!blobUrl && (!doc || !isVercelBlobUrl(doc.blobUrl))) {
        return {
          fileId,
          status: "failed",
          error: "Blob upload failed; no stored blob copy available",
        };
      }

      const storedBlobUrl = blobUrl ?? doc?.blobUrl ?? null;

      if (doc) {
        // Lock document type after first sync/import
        const lockedDocumentType = doc.documentType;
        doc = await updateProjectDoc({
          docId: doc.id,
          data: {
            blobUrl: storedBlobUrl ?? doc.blobUrl,
            sizeBytes: sizeBytes ?? content.length,
            mimeType: finalMimeType,
            filename: adjustedFilename,
            documentType: lockedDocumentType,
            ...(entityName && entityKind ? { entityName, entityKind } : {}),
            metadata: {
              ...((doc.metadata as object) || {}),
              googleFileId: fileId,
              googleParentIds,
              modifiedTime,
              sourceWebUrl,
            },
          },
        });
      } else {
        doc = await createProjectDoc({
          projectId: project.id,
          createdBy: userId,
          organizationId: project.organizationId ?? null,
          blobUrl: storedBlobUrl ?? "about:blank",
          filename: adjustedFilename,
          mimeType: finalMimeType,
          sizeBytes: sizeBytes ?? content.length,
          documentType: effectiveDocumentType,
          entityName: entityName && entityKind ? entityName : null,
          entityKind: entityName && entityKind ? entityKind : null,
          parseStatus: "pending",
          metadata: {
            googleFileId: fileId,
            googleParentIds,
            modifiedTime,
            sourceWebUrl,
            ...(workflowAgentId ? { workflowAgentId } : {}),
          },
        });
      }

      // 5. Ingest (Vectorize) synchronously
      try {
        await deleteByFilterFromTurbopuffer({
          namespace,
          filters: ["doc_id", "Eq", doc.id],
        });

        if (effectiveDocumentType === "general_doc") {
          const result = await ingestUploadedDocToTurbopuffer({
            docId: doc.id,
            projectSlug: project.isDefault ? "default" : project.name,
            projectId: project.id,
            isDefaultProject: project.isDefault,
            createdBy: userId,
            organizationId: doc.organizationId,
            filename: adjustedFilename,
            category: doc.category,
            description: doc.description,
            documentType: effectiveDocumentType,
            mimeType: finalMimeType,
            blobUrl: storedBlobUrl ?? doc.blobUrl,
            sourceUrl: sourceWebUrl ?? undefined,
            sourceCreatedAtMs: doc.createdAt.getTime(),
            fileBuffer: content,
          });

          await markProjectDocIndexed({
            docId: doc.id,
            indexedAt: new Date(),
            turbopufferNamespace: result.namespace,
          });
        } else {
          const summaryTextParts = [
            `Document type: ${effectiveDocumentType}`,
            adjustedFilename ? `Filename: ${adjustedFilename}` : "",
          ].filter((p) => p.length > 0);
          const summaryText = summaryTextParts.join("\n");
          const result = await ingestDocSummaryToTurbopuffer({
            docId: doc.id,
            projectId: project.id,
            isDefaultProject: project.isDefault,
            createdBy: userId,
            organizationId: doc.organizationId,
            filename: adjustedFilename,
            mimeType: finalMimeType,
            blobUrl: storedBlobUrl ?? doc.blobUrl,
            sourceUrl: sourceWebUrl ?? undefined,
            sourceCreatedAtMs: doc.createdAt.getTime(),
            documentType: effectiveDocumentType,
            summaryText,
            metadata: {
              source_url: sourceWebUrl ?? null,
            },
          });
          await markProjectDocIndexed({
            docId: doc.id,
            indexedAt: new Date(),
            turbopufferNamespace: result.namespace,
          });
        }

        await updateProjectDoc({
          docId: doc.id,
          data: {
            parseStatus:
              effectiveDocumentType === "general_doc" ? "parsed" : "pending",
            metadata: {
              ...((doc.metadata as object) || {}),
              googleFileId: fileId,
              googleParentIds,
              modifiedTime,
              lastSyncedAt: new Date().toISOString(),
              sourceWebUrl,
            },
          },
        });

        if (effectiveDocumentType === "invoice") {
          const sender =
            typeof invoiceSender === "string" && invoiceSender.trim().length > 0
              ? invoiceSender.trim().slice(0, 500)
              : undefined;
          const recipient =
            typeof invoiceRecipient === "string" &&
            invoiceRecipient.trim().length > 0
              ? invoiceRecipient.trim().slice(0, 500)
              : undefined;

          if (sender || recipient) {
            await upsertInvoiceForDocument({
              documentId: doc.id,
              data: {
                sender,
                recipient,
              },
            });
          }
        }

        // Trigger structured parsing for financial docs
        if (effectiveDocumentType !== "general_doc") {
          const parseResult = await parseStructuredProjectDoc({
            docId: doc.id,
            userId,
            ingestSummaryToTurbopuffer: false,
          });
          if (!parseResult.ok) {
            console.warn("Google sync: Structured doc parse failed", {
              docId: doc.id,
              error: parseResult.error,
            });
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown ingestion error";
        await markProjectDocIndexError({ docId: doc.id, error: message });
        return { fileId, status: "failed", error: message };
      }

      return {
        fileId,
        status: "synced",
        docId: doc.id,
        filename: adjustedFilename,
      };
    } catch (error) {
      const cause =
        error instanceof Error && typeof error.cause === "string"
          ? error.cause
          : null;
      return {
        fileId,
        status: "failed",
        error:
          cause ?? (error instanceof Error ? error.message : "Sync failed"),
      };
    } finally {
      releaseSyncLock(lockKey);
    }
  };

  return await Promise.all(items.map(processItem));
}
