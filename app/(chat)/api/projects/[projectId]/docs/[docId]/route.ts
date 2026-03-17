import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { after, type NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  deleteProjectDocById,
  getProjectByIdForUser,
  getProjectDocById,
  getProjectRole,
  markProjectDocDeleting,
  updateProjectDoc,
} from "@/lib/db/queries";
import { syncLocalEditToSharePoint } from "@/lib/integrations/microsoft/sync-microsoft-docs";
import { namespacesForSourceTypes } from "@/lib/rag/source-routing";
import {
  createEmbedding,
  deleteByFilterFromTurbopuffer,
  type TurbopufferUpsertRow,
  upsertRowsToTurbopuffer,
} from "@/lib/rag/turbopuffer";

function isVercelBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function isEditableMimeType(mimeType: string): boolean {
  return mimeType === "text/markdown" || mimeType === "text/plain";
}

function hasMicrosoftMetadata(metadata: unknown): metadata is {
  driveId: string;
  itemId: string;
  lastModifiedDateTime?: string;
  sourceWebUrl?: string;
} {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  const m = metadata as Record<string, unknown>;
  return (
    typeof m.driveId === "string" &&
    m.driveId.length > 0 &&
    typeof m.itemId === "string" &&
    m.itemId.length > 0
  );
}

// Simple text chunker
function chunkText(text: string, maxLen = 2400, overlap = 200): string[] {
  const chunks: string[] = [];
  const n = text.length;
  if (n === 0 || maxLen <= 0) {
    return chunks;
  }
  const effectiveOverlap = Math.max(0, Math.min(overlap, maxLen - 1));
  const step = maxLen - effectiveOverlap;
  let i = 0;
  while (i < n) {
    const end = Math.min(i + maxLen, n);
    const slice = text.slice(i, end).trim();
    if (slice) {
      chunks.push(slice);
    }
    if (end === n) {
      break;
    }
    i += step;
  }
  return chunks;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, docId } = await params;

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await getProjectDocById({ docId });
  if (!doc || doc.projectId !== project.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check if this is an editable file type
  if (!isEditableMimeType(doc.mimeType)) {
    return NextResponse.json(
      { error: "This file type is not editable" },
      { status: 400 }
    );
  }

  // Fetch the content from blob storage
  let content = "";
  try {
    const response = await fetch(doc.blobUrl);
    if (response.ok) {
      content = await response.text();
    }
  } catch {
    // Content fetch failed, return empty
  }

  const metadata = doc.metadata as Record<string, unknown> | null;
  const isMicrosoftDoc = hasMicrosoftMetadata(metadata);

  return NextResponse.json(
    {
      doc: {
        ...doc,
        content,
        isMicrosoftDoc,
        microsoftMetadata: isMicrosoftDoc
          ? {
              driveId: metadata?.driveId,
              itemId: metadata?.itemId,
              lastModifiedDateTime: metadata?.lastModifiedDateTime,
              sourceWebUrl: metadata?.sourceWebUrl,
            }
          : null,
      },
    },
    { status: 200 }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, docId } = await params;

  const role = await getProjectRole({ projectId, userId: session.user.id });
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await getProjectDocById({ docId });
  if (!doc || doc.projectId !== project.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check if this is an editable file type
  if (!isEditableMimeType(doc.mimeType)) {
    return NextResponse.json(
      { error: "This file type is not editable" },
      { status: 400 }
    );
  }

  // Only creator or admin can edit
  if (role === "member" && doc.createdBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { content } = body as { content?: string };
  const newContent = content ?? "";

  // Delete old blob if it's a Vercel blob
  if (isVercelBlobUrl(doc.blobUrl)) {
    await del(doc.blobUrl);
  }

  // Upload new content to Vercel Blob
  const blob = await put(
    `docs/${projectId}/${Date.now()}-${doc.filename}`,
    newContent,
    {
      access: "public",
      contentType: doc.mimeType,
    }
  );

  // Update metadata with local edit timestamp
  const existingMetadata = (doc.metadata as Record<string, unknown>) || {};
  const updatedMetadata = {
    ...existingMetadata,
    lastLocalEdit: new Date().toISOString(),
  };

  await updateProjectDoc({
    docId,
    data: {
      blobUrl: blob.url,
      sizeBytes: new Blob([newContent]).size,
      metadata: updatedMetadata,
    },
  });

  // Re-index in Turbopuffer
  const [docsNamespace] = namespacesForSourceTypes(
    ["docs"],
    project.id,
    project.isDefault
  );

  if (docsNamespace && newContent.trim()) {
    await deleteByFilterFromTurbopuffer({
      namespace: docsNamespace,
      filters: ["doc_id", "Eq", docId],
    });

    const chunks = chunkText(newContent.trim());
    const indexedAtMs = Date.now();
    const contentHash = crypto
      .createHash("sha1")
      .update(newContent)
      .digest("hex");
    const rows: TurbopufferUpsertRow[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const metadataPrefix = `filename: ${doc.filename}\ndescription: ${doc.description || ""}\n\n`;
      const vector = await createEmbedding(`${metadataPrefix}${chunk}`);

      const idHash = crypto
        .createHash("sha256")
        .update(`${docId}:${contentHash}:${index}`)
        .digest("hex")
        .slice(0, 40);
      const rowId = `docs_${idHash}`;

      rows.push({
        id: rowId,
        vector,
        content: chunk.length > 3800 ? `${chunk.slice(0, 3800)}…` : chunk,
        sourceType: "docs",
        doc_source: "uploaded",
        source_url: (existingMetadata.sourceWebUrl as string | null) ?? null,
        sourceCreatedAtMs: doc.createdAt.getTime(),
        indexedAtMs,
        doc_id: docId,
        project_id: projectId,
        created_by: session.user.id,
        organization_id: null,
        filename: doc.filename,
        doc_category: doc.category,
        doc_description: doc.description,
        mime_type: doc.mimeType,
        blob_url: blob.url,
        document_type: doc.documentType,
        chunk_index: index,
      });
    }

    if (rows.length > 0) {
      await upsertRowsToTurbopuffer({ namespace: docsNamespace, rows });
    }

    await updateProjectDoc({
      docId,
      data: { indexedAt: new Date() },
    });
  }

  // Queue background sync to SharePoint if this is a Microsoft doc
  const isMicrosoftDoc = hasMicrosoftMetadata(existingMetadata);
  if (isMicrosoftDoc) {
    const userId = session.user.id;

    // Use Next.js after() for background processing with retry logic
    after(async () => {
      await syncLocalEditToSharePoint({
        docId,
        userId,
        maxRetries: 3,
      });
    });
  }

  const updatedDoc = await getProjectDocById({ docId });

  return NextResponse.json(
    {
      doc: {
        ...updatedDoc,
        content: newContent,
        isMicrosoftDoc,
        syncQueued: isMicrosoftDoc,
      },
    },
    { status: 200 }
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, docId } = await params;

  const role = await getProjectRole({ projectId, userId: session.user.id });
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await getProjectDocById({ docId });
  if (!doc || doc.projectId !== project.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role === "member" && doc.createdBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await markProjectDocDeleting({ docId: doc.id });

  const [docsNamespace] = namespacesForSourceTypes(
    ["docs"],
    project.id,
    project.isDefault
  );

  if (docsNamespace) {
    await deleteByFilterFromTurbopuffer({
      namespace: docsNamespace,
      filters: ["doc_id", "Eq", doc.id],
    });
  }

  if (isVercelBlobUrl(doc.blobUrl)) {
    await del(doc.blobUrl);
  }

  await deleteProjectDocById({ docId: doc.id, userId: session.user.id });

  return NextResponse.json({ deleted: true }, { status: 200 });
}
