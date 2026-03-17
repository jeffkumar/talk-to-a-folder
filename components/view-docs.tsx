"use client";

import { format } from "date-fns";
import {
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  LoaderIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { GoogleDriveIcon, OneDriveIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { ENABLE_MICROSOFT_INTEGRATION } from "@/lib/constants";
import type { ProjectDoc } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

type MembersResponse = {
  members: Array<
    | {
        kind: "user";
        userId: string;
        email: string;
        role: "owner" | "admin" | "member";
      }
    | { kind: "invite"; email: string; role: "admin" | "member" }
  >;
};

type MicrosoftStatus = { connected: boolean };
type GoogleStatus = { connected: boolean };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

type ViewDocsProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ignoredDocIds: string[];
  setIgnoredDocIds: (ids: string[]) => void;
};

export function ViewDocs({
  isOpen,
  onOpenChange,
  ignoredDocIds,
  setIgnoredDocIds,
}: ViewDocsProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    selectedProjectId,
    selectedProject,
    isLoading: isProjectLoading,
  } = useProjectSelector();
  const [docToDelete, setDocToDelete] = useState<ProjectDoc | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ docs: ProjectDoc[] }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/docs` : null,
    fetcher
  );

  const { data: membersData } = useSWR<MembersResponse>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/members` : null,
    fetcher
  );

  const { data: msStatus } = useSWR<MicrosoftStatus>(
    ENABLE_MICROSOFT_INTEGRATION ? "/api/integrations/microsoft/status" : null,
    fetcher
  );

  const { data: googleStatus } = useSWR<GoogleStatus>(
    "/api/integrations/google/status",
    fetcher
  );

  const currentUserId = session?.user?.id ?? null;
  const role = (() => {
    if (!currentUserId) {
      return null;
    }
    const row = membersData?.members?.find(
      (m) => m.kind === "user" && m.userId === currentUserId
    );
    return row && row.kind === "user" ? row.role : null;
  })();
  const isAdmin = role === "owner" || role === "admin";
  const msConnected = Boolean(msStatus?.connected);
  const googleConnected = Boolean(googleStatus?.connected);

  const toggleDocVisibility = (docId: string) => {
    if (ignoredDocIds.includes(docId)) {
      setIgnoredDocIds(ignoredDocIds.filter((id) => id !== docId));
    } else {
      setIgnoredDocIds([...ignoredDocIds, docId]);
    }
  };

  const truncateFilename = (filename: string, maxChars = 20) => {
    if (filename.length <= maxChars) {
      return filename;
    }
    return `${filename.slice(0, maxChars)}…`;
  };

  const projectName = selectedProject?.name ?? "";

  const openFiles = () => {
    onOpenChange(false);
    router.push("/files");
  };

  const deleteDoc = (doc: ProjectDoc) => {
    if (!selectedProjectId) {
      toast.error("No project selected");
      return;
    }

    const deletePromise = fetch(
      `/api/projects/${selectedProjectId}/docs/${doc.id}`,
      { method: "DELETE" }
    ).then(async (response) => {
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Failed to delete document");
      }
    });

    toast.promise(deletePromise, {
      loading: "Deleting document...",
      success: () => {
        setIgnoredDocIds(ignoredDocIds.filter((id) => id !== doc.id));
        void mutate();
        setDocToDelete(null);
        return "Document deleted";
      },
      error: (error) =>
        error instanceof Error ? error.message : "Failed to delete document",
    });
  };

  const syncMicrosoftDoc = (doc: ProjectDoc) => {
    if (!selectedProjectId) {
      toast.error("No project selected");
      return;
    }
    if (!isAdmin) {
      toast.error("Only project admins can sync integration files");
      return;
    }
    if (!msConnected) {
      toast.error("Connect Microsoft first to sync files");
      return;
    }

    const metadata =
      doc.metadata && typeof doc.metadata === "object"
        ? (doc.metadata as Record<string, unknown>)
        : null;
    const driveId =
      metadata && isNonEmptyString(metadata.driveId) ? metadata.driveId : null;
    const itemId =
      metadata && isNonEmptyString(metadata.itemId) ? metadata.itemId : null;
    if (!driveId || !itemId) {
      toast.error("Missing SharePoint/OneDrive metadata for this document");
      return;
    }

    const syncPromise = fetch(
      `/api/projects/${selectedProjectId}/integrations/microsoft/sync`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          driveId,
          items: [{ itemId, filename: doc.filename }],
          documentType: doc.documentType,
        }),
      }
    ).then(async (response) => {
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Failed to sync document");
      }
    });

    toast.promise(syncPromise, {
      loading: "Syncing file...",
      success: () => {
        void mutate();
        return "Sync started";
      },
      error: (error) =>
        error instanceof Error ? error.message : "Failed to sync document",
    });
  };

  const syncGoogleDoc = (doc: ProjectDoc) => {
    if (!selectedProjectId) {
      toast.error("No project selected");
      return;
    }
    if (!isAdmin) {
      toast.error("Only project admins can sync integration files");
      return;
    }
    if (!googleConnected) {
      toast.error("Connect Google Drive first to sync files");
      return;
    }

    const metadata =
      doc.metadata && typeof doc.metadata === "object"
        ? (doc.metadata as Record<string, unknown>)
        : null;
    const googleFileId =
      metadata && isNonEmptyString(metadata.googleFileId)
        ? metadata.googleFileId
        : null;
    if (!googleFileId) {
      toast.error("Missing Google Drive metadata for this document");
      return;
    }

    const syncPromise = fetch(
      `/api/projects/${selectedProjectId}/integrations/google/sync`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [{ fileId: googleFileId, filename: doc.filename }],
          documentType: doc.documentType,
        }),
      }
    ).then(async (response) => {
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Failed to sync document");
      }
    });

    toast.promise(syncPromise, {
      loading: "Syncing file...",
      success: () => {
        void mutate();
        return "Sync started";
      },
      error: (error) =>
        error instanceof Error ? error.message : "Failed to sync document",
    });
  };

  const clearAllDocs = () => {
    if (!selectedProjectId) {
      toast.error("No project selected");
      return;
    }

    const clearPromise = fetch(
      `/api/projects/${selectedProjectId}/docs/clear`,
      {
        method: "POST",
      }
    ).then(async (response) => {
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "Failed to clear documents");
      }
    });

    toast.promise(clearPromise, {
      loading: "Clearing documents...",
      success: () => {
        setIgnoredDocIds([]);
        void mutate();
        setShowClearAllDialog(false);
        return "All documents cleared";
      },
      error: (error) =>
        error instanceof Error ? error.message : "Failed to clear documents",
    });
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={isOpen}>
      <SheetContent
        className="flex w-[400px] flex-col sm:w-[540px]"
        side="right"
      >
        <SheetHeader>
          <SheetTitle>{projectName || "Project"}</SheetTitle>
          <SheetDescription>Manage documents for this chat.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-end">
          <Button onClick={openFiles} size="sm" type="button" variant="outline">
            Open Files
          </Button>
        </div>

        <div className="mt-6 flex-1 overflow-hidden">
          {isLoading || isProjectLoading || !selectedProjectId ? (
            <div className="flex h-full items-center justify-center">
              <LoaderIcon className="animate-spin text-muted-foreground" />
            </div>
          ) : data?.docs?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No documents found for this project.
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {data?.docs?.map((doc) => {
                  const isIgnored = ignoredDocIds.includes(doc.id);
                  const displayFilename = truncateFilename(doc.filename, 20);
                  const isTruncated = displayFilename !== doc.filename;
                  const metadata =
                    doc.metadata && typeof doc.metadata === "object"
                      ? (doc.metadata as Record<string, unknown>)
                      : null;
                  const sourceWebUrl =
                    metadata && typeof metadata.sourceWebUrl === "string"
                      ? metadata.sourceWebUrl
                      : "";
                  const driveId =
                    metadata && typeof metadata.driveId === "string"
                      ? metadata.driveId
                      : "";
                  const itemId =
                    metadata && typeof metadata.itemId === "string"
                      ? metadata.itemId
                      : "";
                  const sourceLower = sourceWebUrl.toLowerCase();
                  const isMicrosoftSource =
                    ENABLE_MICROSOFT_INTEGRATION &&
                    (Boolean(driveId && itemId) ||
                      sourceLower.includes("sharepoint.com") ||
                      sourceLower.includes("onedrive"));
                  const googleFileId =
                    metadata && typeof metadata.googleFileId === "string"
                      ? metadata.googleFileId
                      : "";
                  const isGoogleSource = Boolean(googleFileId);
                  const canDelete =
                    isAdmin ||
                    (currentUserId !== null && doc.createdBy === currentUserId);
                  return (
                    <div
                      className="flex items-center justify-between rounded-lg border bg-card p-3 text-card-foreground shadow-sm"
                      key={doc.id}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="cursor-help select-none truncate font-medium text-sm"
                              title={isTruncated ? undefined : doc.filename}
                            >
                              {displayFilename}
                            </span>
                          </TooltipTrigger>
                          {isTruncated && (
                            <TooltipContent side="top">
                              {doc.filename}
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(doc.createdAt), "PP")}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <span>{doc.documentType}</span>
                          <span>·</span>
                          {doc.parseStatus === "pending" && (
                            <span className="status-badge status-badge-pending">
                              <Loader2Icon className="h-3 w-3 animate-spin" />
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
                              Needs Review
                            </span>
                          )}
                        </div>
                        {isGoogleSource ? (
                          googleConnected && sourceWebUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  className="flex items-center gap-1 text-muted-foreground text-xs underline underline-offset-2"
                                  href={sourceWebUrl}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  <span
                                    className="text-google-drive"
                                    title="Google Drive"
                                  >
                                    <GoogleDriveIcon size={14} />
                                  </span>
                                  Google Drive
                                </a>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                This file is stored in Google Drive.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                  <span
                                    className="text-google-drive opacity-50"
                                    title="Google Drive"
                                  >
                                    <GoogleDriveIcon size={14} />
                                  </span>
                                  Google Drive
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {googleConnected
                                  ? "This file is stored in Google Drive."
                                  : "Connect Google Drive to open source file."}
                              </TooltipContent>
                            </Tooltip>
                          )
                        ) : isMicrosoftSource ? (
                          msConnected && sourceWebUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  className="flex items-center gap-1 text-muted-foreground text-xs underline underline-offset-2"
                                  href={sourceWebUrl}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  <span
                                    className="text-onedrive"
                                    title="SharePoint / OneDrive"
                                  >
                                    <OneDriveIcon size={14} />
                                  </span>
                                  SharePoint / OneDrive
                                </a>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                This file is stored in SharePoint / OneDrive.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                  <span
                                    className="text-onedrive opacity-50"
                                    title="SharePoint / OneDrive"
                                  >
                                    <OneDriveIcon size={14} />
                                  </span>
                                  SharePoint / OneDrive
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {msConnected
                                  ? "This file is stored in SharePoint / OneDrive."
                                  : "Connect Microsoft to open source file."}
                              </TooltipContent>
                            </Tooltip>
                          )
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          className="shrink-0"
                          onClick={() => toggleDocVisibility(doc.id)}
                          size="icon"
                          title={
                            isIgnored ? "Show in context" : "Hide from context"
                          }
                          type="button"
                          variant="ghost"
                        >
                          {isIgnored ? (
                            <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </Button>
                        {isGoogleSource ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  className="shrink-0"
                                  disabled={!isAdmin || !googleConnected}
                                  onClick={() => syncGoogleDoc(doc)}
                                  size="icon"
                                  title="Sync file"
                                  type="button"
                                  variant="ghost"
                                >
                                  <RefreshCwIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {isAdmin ? (
                              googleConnected ? (
                                <TooltipContent side="top">
                                  Sync from Google Drive
                                </TooltipContent>
                              ) : (
                                <TooltipContent side="top">
                                  Connect Google Drive to sync files.
                                </TooltipContent>
                              )
                            ) : (
                              <TooltipContent side="top">
                                Only project admins can sync integration files.
                              </TooltipContent>
                            )}
                          </Tooltip>
                        ) : isMicrosoftSource ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  className="shrink-0"
                                  disabled={!isAdmin || !msConnected}
                                  onClick={() => syncMicrosoftDoc(doc)}
                                  size="icon"
                                  title="Sync file"
                                  type="button"
                                  variant="ghost"
                                >
                                  <RefreshCwIcon className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {isAdmin ? (
                              msConnected ? (
                                <TooltipContent side="top">
                                  Sync from SharePoint
                                </TooltipContent>
                              ) : (
                                <TooltipContent side="top">
                                  Connect Microsoft to sync files.
                                </TooltipContent>
                              )
                            ) : (
                              <TooltipContent side="top">
                                Only project admins can sync integration files.
                              </TooltipContent>
                            )}
                          </Tooltip>
                        ) : null}
                        <Button
                          className="shrink-0"
                          disabled={!canDelete}
                          onClick={() => setDocToDelete(doc)}
                          size="icon"
                          title={
                            isGoogleSource || isMicrosoftSource
                              ? "Remove from context"
                              : "Delete document"
                          }
                          type="button"
                          variant="ghost"
                        >
                          <Trash2Icon className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end border-t pt-3">
          <Button
            className="h-8 px-2 text-xs"
            onClick={() => setShowClearAllDialog(true)}
            size="sm"
            type="button"
            variant="destructive"
          >
            Clear all docs
          </Button>
        </div>
      </SheetContent>

      <AlertDialog
        onOpenChange={(open) => !open && setDocToDelete(null)}
        open={docToDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {(() => {
              const metadata =
                docToDelete?.metadata &&
                typeof docToDelete.metadata === "object"
                  ? (docToDelete.metadata as Record<string, unknown>)
                  : null;
              const sourceWebUrl =
                metadata && typeof metadata.sourceWebUrl === "string"
                  ? metadata.sourceWebUrl
                  : "";
              const driveId =
                metadata && typeof metadata.driveId === "string"
                  ? metadata.driveId
                  : "";
              const itemId =
                metadata && typeof metadata.itemId === "string"
                  ? metadata.itemId
                  : "";
              const sourceLower = sourceWebUrl.toLowerCase();
              const isMicrosoftSource =
                ENABLE_MICROSOFT_INTEGRATION &&
                (Boolean(driveId && itemId) ||
                  sourceLower.includes("sharepoint.com") ||
                  sourceLower.includes("onedrive"));
              const googleFileId =
                metadata && typeof metadata.googleFileId === "string"
                  ? metadata.googleFileId
                  : "";
              const isGoogleSource = Boolean(googleFileId);
              const isIntegrationSource = isMicrosoftSource || isGoogleSource;
              const integrationName = isGoogleSource
                ? "Google Drive"
                : "SharePoint/OneDrive";

              return (
                <>
                  <AlertDialogTitle>
                    {isIntegrationSource
                      ? "Remove from context?"
                      : "Delete document?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isIntegrationSource
                      ? `This will remove the file from Flowchat context and delete its stored copy and indexed content. This does not delete the file in ${integrationName}.`
                      : "This action cannot be undone. This will permanently delete the file, remove it from storage, and remove its indexed content."}
                  </AlertDialogDescription>
                </>
              );
            })()}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (docToDelete) {
                  deleteDoc(docToDelete);
                }
              }}
              type="button"
            >
              {(() => {
                const metadata =
                  docToDelete?.metadata &&
                  typeof docToDelete.metadata === "object"
                    ? (docToDelete.metadata as Record<string, unknown>)
                    : null;
                const sourceWebUrl =
                  metadata && typeof metadata.sourceWebUrl === "string"
                    ? metadata.sourceWebUrl
                    : "";
                const driveId =
                  metadata && typeof metadata.driveId === "string"
                    ? metadata.driveId
                    : "";
                const itemId =
                  metadata && typeof metadata.itemId === "string"
                    ? metadata.itemId
                    : "";
                const sourceLower = sourceWebUrl.toLowerCase();
                const isMicrosoftSource =
                  ENABLE_MICROSOFT_INTEGRATION &&
                  (Boolean(driveId && itemId) ||
                    sourceLower.includes("sharepoint.com") ||
                    sourceLower.includes("onedrive"));
                const googleFileId =
                  metadata && typeof metadata.googleFileId === "string"
                    ? metadata.googleFileId
                    : "";
                const isGoogleSource = Boolean(googleFileId);
                return isMicrosoftSource || isGoogleSource
                  ? "Remove"
                  : "Delete";
              })()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={setShowClearAllDialog}
        open={showClearAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all documents?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              docs in this project and remove their indexed content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearAllDocs} type="button">
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
