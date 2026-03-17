"use client";

import {
  ExternalLink,
  File as FileIcon,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { BusinessNameTypeahead } from "@/components/business-name-typeahead";
import { CreateDocumentTypeModal } from "@/components/create-document-type-modal";
import { GoogleDriveIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectSelector } from "@/hooks/use-project-selector";
import {
  GOOGLE_DOCS_MIME_TYPES,
  getFileTypesDisplayString,
  isGoogleDocsMimeType,
  isSupportedFileName,
  SUPPORTED_MIME_TYPES,
} from "@/lib/constants/file-types";
import { fetcher, getLocalStorage } from "@/lib/utils";

type GoogleStatus =
  | { connected: false }
  | {
      connected: true;
      accountEmail: string | null;
      scopes: string[];
      expiresAt: string | null;
    };

type PickedFile = {
  id: string;
  name: string;
  mimeType: string;
};

type SyncedDoc = {
  docId: string;
  filename: string;
  url?: string | null;
  documentType?: "general_doc" | "bank_statement" | "cc_statement" | "invoice";
  parseStatus?: "pending" | "parsed" | "failed" | "needs_review";
  fileId: string;
  lastSyncedAt: string;
  modifiedTime?: string;
};

type IngestDocumentType =
  | "general_doc"
  | "bank_statement"
  | "cc_statement"
  | "invoice"
  | `workflow:${string}`;

type WorkflowAgentOption = {
  id: string;
  name: string;
  description?: string;
  acceptedMimeTypes?: string[];
};

type InvoiceParties = { senders: string[]; recipients: string[] };

const GOOGLE_DOCS_EXPORT_MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation": "application/pdf",
};

const PICKER_MIME_TYPES = [
  ...SUPPORTED_MIME_TYPES,
  ...GOOGLE_DOCS_MIME_TYPES,
].join(",");

function getEffectiveMimeType(mimeType: string): string {
  return GOOGLE_DOCS_EXPORT_MIME_TYPES[mimeType] ?? mimeType;
}

function getMatchingWorkflowAgents(
  agents: WorkflowAgentOption[],
  mimeType: string
): WorkflowAgentOption[] {
  const effectiveMime = getEffectiveMimeType(mimeType);
  return agents.filter((agent) => {
    const accepted = agent.acceptedMimeTypes ?? [];
    return accepted.includes(effectiveMime);
  });
}

function isSupportedGoogleFile(name: string | null, mimeType: string): boolean {
  if (isGoogleDocsMimeType(mimeType)) {
    return true;
  }
  return isSupportedFileName(name);
}

let gapiScriptLoaded = false;
let pickerApiLoaded = false;

async function loadGooglePickerApi(): Promise<void> {
  if (!gapiScriptLoaded) {
    await new Promise<void>((resolve, reject) => {
      if (window.gapi) {
        gapiScriptLoaded = true;
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = () => {
        gapiScriptLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load Google API"));
      document.head.appendChild(script);
    });
  }

  if (!pickerApiLoaded) {
    await new Promise<void>((resolve, reject) => {
      window.gapi?.load("picker", {
        callback: () => {
          pickerApiLoaded = true;
          resolve();
        },
        onerror: () => reject(new Error("Failed to load Picker API")),
      });
    });
  }
}

export function GoogleIntegrationCard() {
  const { selectedProjectId } = useProjectSelector();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();

  const {
    data: status,
    mutate: mutateStatus,
    isLoading,
  } = useSWR<GoogleStatus>("/api/integrations/google/status", fetcher);

  useEffect(() => {
    const err = searchParams.get("googleError");
    if (err === "invalid_state") {
      toast.error("Google connect failed. Please click Connect again.");
    }
  }, [searchParams]);

  const [pickedFiles, setPickedFiles] = useState<PickedFile[]>([]);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [inFlightSyncKeys, setInFlightSyncKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [docTypeByKey, setDocTypeByKey] = useState<
    Record<string, IngestDocumentType>
  >(() => ({}));

  const [invoiceSender, setInvoiceSender] = useState(() => {
    const v = getLocalStorage("invoice_sender_last") as unknown;
    return typeof v === "string" ? v : "";
  });
  const [invoiceRecipient, setInvoiceRecipient] = useState(() => {
    const v = getLocalStorage("invoice_recipient_last") as unknown;
    return typeof v === "string" ? v : "";
  });
  const [invoiceSyncDialog, setInvoiceSyncDialog] = useState<{
    items: Array<{ fileId: string; filename: string }>;
  } | null>(null);

  const [importDialog, setImportDialog] = useState<{
    items: Array<{ fileId: string; filename: string }>;
    documentType: IngestDocumentType;
    workflowAgentId?: string;
  } | null>(null);
  const [importEntityKind, setImportEntityKind] = useState<
    "personal" | "business"
  >("personal");
  const [importBusinessName, setImportBusinessName] = useState("");
  const [showCreateDocTypeModal, setShowCreateDocTypeModal] = useState(false);

  useEffect(() => {
    setPickedFiles([]);
    setInFlightSyncKeys(new Set());
    setDocTypeByKey({});
  }, []);

  useEffect(() => {
    localStorage.setItem("invoice_sender_last", invoiceSender);
  }, [invoiceSender]);

  useEffect(() => {
    localStorage.setItem("invoice_recipient_last", invoiceRecipient);
  }, [invoiceRecipient]);

  const getTypeForKey = (key: string): IngestDocumentType =>
    docTypeByKey[key] ?? "general_doc";

  const setTypeForKey = (key: string, value: IngestDocumentType) => {
    setDocTypeByKey((prev) => ({ ...prev, [key]: value }));
  };

  const { data: syncedDocsData, mutate: mutateSyncedDocs } = useSWR<{
    docs: SyncedDoc[];
  }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/integrations/google/sync`
      : null,
    fetcher,
    {
      shouldRetryOnError: false,
      refreshInterval: (latestData) => {
        const hasPending = (latestData?.docs ?? []).some(
          (d) => d.parseStatus === "pending"
        );
        return hasPending ? 3000 : 0;
      },
    }
  );

  const { data: invoiceParties } = useSWR<InvoiceParties>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/invoices/parties`
      : null,
    fetcher
  );

  const { data: businessNamesData } = useSWR<{ names: string[] }>(
    "/api/entities/business-names",
    fetcher,
    { shouldRetryOnError: false }
  );

  const { data: workflowAgentsData } = useSWR<{
    agents: WorkflowAgentOption[];
  }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/workflow-agents`
      : null,
    fetcher
  );
  const workflowAgents = workflowAgentsData?.agents ?? [];

  const syncedDocByKey = (syncedDocsData?.docs ?? []).reduce<
    Record<string, SyncedDoc>
  >((acc, doc) => {
    acc[doc.fileId] = doc;
    return acc;
  }, {});

  const isTypeLocked = (syncKey: string) => Boolean(syncedDocByKey[syncKey]);

  useEffect(() => {
    const docs = syncedDocsData?.docs;
    if (!Array.isArray(docs) || docs.length === 0) {
      return;
    }
    setDocTypeByKey((prev) => {
      const next: Record<string, IngestDocumentType> = { ...prev };
      for (const doc of docs) {
        const key = doc.fileId;
        if (typeof next[key] === "string") {
          continue;
        }
        const stored = doc.documentType;
        next[key] = stored ?? "general_doc";
      }
      return next;
    });
  }, [syncedDocsData?.docs]);

  const connectUrl = "/api/integrations/google/start?returnTo=/integrations";

  const pickerCallbackRef = useRef<
    ((data: GooglePickerCallbackData) => void) | null
  >(null);

  const handlePickerResult = useCallback((data: GooglePickerCallbackData) => {
    if (data.action !== "picked" || !data.docs) {
      return;
    }
    const newFiles = data.docs
      .filter((doc) => isSupportedGoogleFile(doc.name, doc.mimeType))
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        mimeType: doc.mimeType,
      }));
    if (newFiles.length === 0) {
      toast.error("No supported files selected");
      return;
    }
    setPickedFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const unique = newFiles.filter((f) => !existingIds.has(f.id));
      return [...prev, ...unique];
    });
  }, []);

  pickerCallbackRef.current = handlePickerResult;

  const openPicker = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
    if (!apiKey) {
      toast.error("Google API key not configured");
      return;
    }

    setIsPickerLoading(true);
    try {
      const tokenRes = (await fetcher(
        "/api/integrations/google/picker-token"
      )) as { accessToken: string };

      await loadGooglePickerApi();

      const view = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMimeTypes(PICKER_MIME_TYPES);

      let builder = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(tokenRes.accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data: GooglePickerCallbackData) => {
          pickerCallbackRef.current?.(data);
        })
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setTitle("Select files to import");

      if (appId) {
        builder = builder.setAppId(appId);
      }

      const picker = builder.build();

      picker.setVisible(true);

      requestAnimationFrame(() => {
        for (const el of document.querySelectorAll<HTMLElement>(
          ".picker-dialog"
        )) {
          el.style.borderRadius = "12px";
          el.style.overflow = "hidden";
        }
        for (const el of document.querySelectorAll<HTMLElement>(
          ".picker-dialog-frame"
        )) {
          el.style.borderRadius = "12px";
        }
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to open file picker"
      );
    } finally {
      setIsPickerLoading(false);
    }
  };

  const removePickedFile = (fileId: string) => {
    setPickedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const importItems = async ({
    items,
    documentType,
    entityKind,
    entityName,
    invoiceSender: sender,
    invoiceRecipient: recipient,
    workflowAgentId,
  }: {
    items: Array<{ fileId: string; filename: string }>;
    documentType: IngestDocumentType;
    entityKind: "personal" | "business";
    entityName: string;
    invoiceSender?: string;
    invoiceRecipient?: string;
    workflowAgentId?: string;
  }) => {
    if (!selectedProjectId) {
      toast.error("Select a project first");
      return;
    }

    const keys = items.map((i) => i.fileId);
    const anyInFlight = keys.some((k) => inFlightSyncKeys.has(k));
    if (anyInFlight) {
      return;
    }

    setInFlightSyncKeys((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        next.add(key);
      }
      return next;
    });

    try {
      const trimmedSender =
        documentType === "invoice" && typeof sender === "string"
          ? sender.trim()
          : "";
      const trimmedRecipient =
        documentType === "invoice" && typeof recipient === "string"
          ? recipient.trim()
          : "";
      const res = await fetch(
        `/api/projects/${selectedProjectId}/integrations/google/sync`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items,
            documentType: workflowAgentId ? "general_doc" : documentType,
            entityName,
            entityKind,
            invoiceSender: trimmedSender.length > 0 ? trimmedSender : undefined,
            invoiceRecipient:
              trimmedRecipient.length > 0 ? trimmedRecipient : undefined,
            workflowAgentId,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Import failed");
      }

      const json = (await res.json()) as {
        results: Array<
          | {
              fileId: string;
              status: "synced";
              docId: string;
              filename: string;
            }
          | { fileId: string; status: "skipped"; reason: string }
          | { fileId: string; status: "failed"; error: string }
        >;
      };

      const syncedCount = Array.isArray(json.results)
        ? json.results.filter((r) => r.status === "synced").length
        : 0;
      const failedCount = Array.isArray(json.results)
        ? json.results.filter((r) => r.status === "failed").length
        : 0;
      const skippedCount = Array.isArray(json.results)
        ? json.results.filter((r) => r.status === "skipped").length
        : 0;
      const firstFailed = Array.isArray(json.results)
        ? json.results.find((r) => r.status === "failed")
        : null;
      const firstFailedMessage =
        firstFailed && "error" in firstFailed
          ? String(firstFailed.error)
          : null;

      if (syncedCount > 0) {
        toast.success(
          `Import completed for ${syncedCount} file(s)${
            skippedCount > 0 || failedCount > 0
              ? ` (${skippedCount} skipped, ${failedCount} failed)`
              : ""
          }`
        );
        setPickedFiles((prev) => prev.filter((f) => !keys.includes(f.id)));
      } else if (skippedCount > 0) {
        toast.message(`Nothing to import (${skippedCount} skipped)`);
      } else {
        toast.error(
          firstFailedMessage
            ? `Import failed: ${firstFailedMessage}`
            : "Import failed"
        );
      }

      await mutateSyncedDocs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
      await mutateSyncedDocs();
    } finally {
      setInFlightSyncKeys((prev) => {
        const next = new Set(prev);
        for (const key of keys) {
          next.delete(key);
        }
        return next;
      });
    }
  };

  const requestImport = ({
    items,
    documentType,
    workflowAgentId,
  }: {
    items: Array<{ fileId: string; filename: string }>;
    documentType: IngestDocumentType;
    workflowAgentId?: string;
  }) => {
    if (documentType === "general_doc" || workflowAgentId) {
      void importItems({
        items,
        documentType,
        entityKind: "personal",
        entityName: "Personal",
        workflowAgentId,
      });
      return;
    }

    setImportEntityKind("personal");
    setImportBusinessName("");
    if (documentType === "invoice") {
      setInvoiceSyncDialog({ items });
      return;
    }
    setImportDialog({ items, documentType });
  };

  const importAllPicked = () => {
    if (pickedFiles.length === 0) {
      return;
    }
    for (const file of pickedFiles) {
      const syncKey = file.id;
      const selectedType =
        syncedDocByKey[syncKey]?.documentType ?? getTypeForKey(syncKey);
      const workflowAgentId = selectedType.startsWith("workflow:")
        ? selectedType.slice("workflow:".length)
        : undefined;
      requestImport({
        items: [{ fileId: file.id, filename: file.name }],
        documentType: workflowAgentId ? "general_doc" : selectedType,
        workflowAgentId,
      });
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-medium text-sm">
            <span title="Google Drive">
              <GoogleDriveIcon size={16} />
            </span>
            <span>Google Drive</span>
          </div>
          {status?.connected && (
            <div className="mt-3 text-muted-foreground text-xs">
              Connected as {status.accountEmail ?? "Unknown account"}
            </div>
          )}
        </div>

        {status?.connected ? (
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  const res = await fetch(
                    "/api/integrations/google/disconnect",
                    { method: "DELETE" }
                  );
                  if (!res.ok) {
                    throw new Error("Failed to disconnect");
                  }
                  toast.success("Disconnected from Google");
                  void mutateStatus();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to disconnect"
                  );
                }
              }}
              type="button"
              variant="outline"
            >
              Disconnect
            </Button>
            <Button
              onClick={() => void mutateStatus()}
              type="button"
              variant="outline"
            >
              Refresh
            </Button>
          </div>
        ) : (
          <Button asChild disabled={isLoading} type="button">
            <a href={connectUrl}>Connect</a>
          </Button>
        )}
      </div>

      {status?.connected && (
        <div className="mt-6 space-y-6">
          {/* Pick from Google Drive */}
          <div className="space-y-2">
            <Button
              disabled={isPickerLoading}
              onClick={() => void openPicker()}
              type="button"
              variant="outline"
            >
              {isPickerLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening…
                </>
              ) : (
                <>
                  <GoogleDriveIcon className="mr-2" size={16} />
                  Pick from Google Drive
                </>
              )}
            </Button>

            {!selectedProjectId && (
              <div className="text-muted-foreground text-xs">
                Select a project to enable Import.
              </div>
            )}

            <div className="text-muted-foreground text-xs">
              Supported: {getFileTypesDisplayString()} (+ Google Docs/Sheets)
            </div>
          </div>

          {/* Picked files staging area */}
          {pickedFiles.length > 0 && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">
                  Selected Files ({pickedFiles.length})
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={!selectedProjectId}
                    onClick={importAllPicked}
                    size="sm"
                    type="button"
                  >
                    Import All
                  </Button>
                  <Button
                    onClick={() => setPickedFiles([])}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="max-h-[260px] overflow-y-auto">
                <div className="divide-y">
                  {pickedFiles.map((file) => {
                    const syncKey = file.id;
                    const isSyncing = inFlightSyncKeys.has(syncKey);
                    const selectedType = getTypeForKey(syncKey);
                    const typeLocked = isTypeLocked(syncKey);

                    return (
                      <div
                        className="flex w-full items-center justify-between gap-3 p-2"
                        key={file.id}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span
                              className="max-w-[250px] truncate"
                              title={file.name}
                            >
                              {file.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Select
                            onValueChange={(value) => {
                              if (value === "__create__") {
                                setShowCreateDocTypeModal(true);
                                return;
                              }
                              setTypeForKey(
                                syncKey,
                                value as IngestDocumentType
                              );
                            }}
                            value={selectedType}
                          >
                            <SelectTrigger
                              className="h-8 w-[140px] text-xs"
                              disabled={!selectedProjectId || typeLocked}
                            >
                              <SelectValue placeholder="Doc type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general_doc">
                                General doc
                              </SelectItem>
                              {getMatchingWorkflowAgents(
                                workflowAgents,
                                file.mimeType
                              ).map((agent) => (
                                <SelectItem
                                  key={agent.id}
                                  value={`workflow:${agent.id}`}
                                >
                                  {agent.name}
                                </SelectItem>
                              ))}
                              <SelectItem
                                className="text-primary"
                                value="__create__"
                              >
                                + Create new type
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            aria-label="Import file"
                            className="shrink-0"
                            disabled={isSyncing || !selectedProjectId}
                            onClick={() => {
                              const docType =
                                syncedDocByKey[syncKey]?.documentType ??
                                selectedType;
                              const workflowAgentId = docType.startsWith(
                                "workflow:"
                              )
                                ? docType.slice("workflow:".length)
                                : undefined;
                              requestImport({
                                items: [
                                  { fileId: file.id, filename: file.name },
                                ],
                                documentType: workflowAgentId
                                  ? "general_doc"
                                  : docType,
                                workflowAgentId,
                              });
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {isSyncing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processing…
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4" />
                                Import
                              </>
                            )}
                          </Button>
                          <Button
                            aria-label="Remove file"
                            className="h-8 w-8"
                            onClick={() => removePickedFile(file.id)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Recently Imported Files */}
          {(syncedDocsData?.docs ?? []).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">Recently Imported</div>
                <Link
                  className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                  href="/files"
                >
                  View all files
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded-md border">
                <div className="divide-y">
                  {(syncedDocsData?.docs ?? []).slice(0, 10).map((doc) => (
                    <div
                      className="flex items-center justify-between gap-3 p-2"
                      key={doc.docId}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm" title={doc.filename}>
                          {doc.filename}
                        </span>
                      </div>
                      <div className="shrink-0 text-xs">
                        {doc.parseStatus === "pending" && (
                          <span className="status-badge status-badge-pending">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing
                          </span>
                        )}
                        {doc.parseStatus === "parsed" && (
                          <span className="status-badge status-badge-success">
                            Parsed
                          </span>
                        )}
                        {doc.parseStatus === "failed" && (
                          <span className="status-badge status-badge-error">
                            Failed
                          </span>
                        )}
                        {doc.parseStatus === "needs_review" && (
                          <span className="status-badge status-badge-warning">
                            Review
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice Import Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setInvoiceSyncDialog(null);
          }
        }}
        open={invoiceSyncDialog !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import invoice</DialogTitle>
            <DialogDescription>
              Choose whether this is Personal or Business. If Business, select
              or type a business name. Sender/recipient are optional.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="google-import-entity-kind-invoice"
              >
                Entity type
              </label>
              <Select
                onValueChange={(value) =>
                  setImportEntityKind(value as "personal" | "business")
                }
                value={importEntityKind}
              >
                <SelectTrigger
                  className="h-9"
                  id="google-import-entity-kind-invoice"
                >
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {importEntityKind === "business" ? (
              <div className="grid gap-1">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="google-import-business-name-invoice"
                >
                  Business name
                </label>
                <BusinessNameTypeahead
                  inputId="google-import-business-name-invoice"
                  onChange={setImportBusinessName}
                  options={businessNamesData?.names ?? []}
                  placeholder="Start typing a business name"
                  value={importBusinessName}
                />
              </div>
            ) : null}

            {importEntityKind === "business" ? (
              <div className="text-[11px] text-muted-foreground">
                Start typing to reuse an existing business name, or type a new
                one.
              </div>
            ) : null}

            <div className="grid gap-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="google-invoice-sender"
              >
                Sender (optional)
              </label>
              <Input
                autoComplete="off"
                id="google-invoice-sender"
                list="google-invoice-sender-options"
                onChange={(e) => setInvoiceSender(e.target.value)}
                placeholder="Select or type sender"
                value={invoiceSender}
              />
              <datalist id="google-invoice-sender-options">
                {(invoiceParties?.senders ?? []).map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>

            <div className="grid gap-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="google-invoice-recipient"
              >
                Recipient (optional)
              </label>
              <Input
                autoComplete="off"
                id="google-invoice-recipient"
                list="google-invoice-recipient-options"
                onChange={(e) => setInvoiceRecipient(e.target.value)}
                placeholder="Select or type recipient"
                value={invoiceRecipient}
              />
              <datalist id="google-invoice-recipient-options">
                {(invoiceParties?.recipients ?? []).map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setInvoiceSyncDialog(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!invoiceSyncDialog) {
                  return;
                }
                const entityName =
                  importEntityKind === "personal"
                    ? "Personal"
                    : importBusinessName.trim();
                if (
                  importEntityKind === "business" &&
                  entityName.length === 0
                ) {
                  toast.error("Business name is required");
                  return;
                }
                void importItems({
                  items: invoiceSyncDialog.items,
                  documentType: "invoice",
                  entityKind: importEntityKind,
                  entityName,
                  invoiceSender,
                  invoiceRecipient,
                });
                setInvoiceSyncDialog(null);
              }}
              type="button"
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* General Import Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setImportDialog(null);
          }
        }}
        open={importDialog !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import file</DialogTitle>
            <DialogDescription>
              Choose whether this is Personal or Business. If Business, select
              or type a business name.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="google-import-entity-kind"
              >
                Entity type
              </label>
              <Select
                onValueChange={(value) =>
                  setImportEntityKind(value as "personal" | "business")
                }
                value={importEntityKind}
              >
                <SelectTrigger className="h-9" id="google-import-entity-kind">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {importEntityKind === "business" ? (
              <div className="grid gap-1">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="google-import-business-name"
                >
                  Business name
                </label>
                <BusinessNameTypeahead
                  inputId="google-import-business-name"
                  onChange={setImportBusinessName}
                  options={businessNamesData?.names ?? []}
                  placeholder="Start typing a business name"
                  value={importBusinessName}
                />
              </div>
            ) : null}
          </div>
          {importEntityKind === "business" ? (
            <div className="text-[11px] text-muted-foreground">
              Start typing to reuse an existing business name, or type a new
              one.
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => setImportDialog(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!importDialog) {
                  return;
                }
                const entityName =
                  importEntityKind === "personal"
                    ? "Personal"
                    : importBusinessName.trim();
                if (
                  importEntityKind === "business" &&
                  entityName.length === 0
                ) {
                  toast.error("Business name is required");
                  return;
                }
                void importItems({
                  items: importDialog.items,
                  documentType: importDialog.documentType,
                  entityKind: importEntityKind,
                  entityName,
                });
                setImportDialog(null);
              }}
              type="button"
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Document Type Modal */}
      <CreateDocumentTypeModal
        onCreated={() => {
          void mutate(`/api/projects/${selectedProjectId}/workflow-agents`);
        }}
        onOpenChange={setShowCreateDocTypeModal}
        open={showCreateDocTypeModal}
      />
    </Card>
  );
}
