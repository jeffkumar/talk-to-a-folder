"use client";

import { format } from "date-fns";
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FileJson2Icon,
  Loader2Icon,
  LoaderIcon,
  MessageCircle,
  PencilIcon,
  RefreshCwIcon,
  Search,
  Square,
  Trash2Icon,
  UploadIcon,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { AskAboutDialog } from "@/components/ask-about-dialog";
import { DocumentTypePicker } from "@/components/document-type-picker";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { FirstProjectPrompt } from "@/components/first-project-prompt";
import {
  GoogleDriveIcon,
  OneDriveIcon,
  SparklesIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { useUploadNotifications } from "@/hooks/use-upload-notifications";
import { ENABLE_MICROSOFT_INTEGRATION } from "@/lib/constants";
import type { ProjectDoc } from "@/lib/db/schema";
import {
  cn,
  fetcher,
  readIgnoredDocIdsForProject,
  writeIgnoredDocIdsForProject,
} from "@/lib/utils";

type SourceFilter = "all" | "microsoft" | "google" | "uploaded";

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

type WorkflowAgent = {
  id: string;
  name: string;
  description?: string;
  acceptedMimeTypes?: string[];
};

type UploadDocumentType =
  | "general_doc"
  | "bank_statement"
  | "cc_statement"
  | "invoice"
  | `workflow:${string}`;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isEditableMimeType(mimeType: string): boolean {
  return mimeType === "text/markdown" || mimeType === "text/plain";
}

function formatDocType(value: string): string {
  if (value === "bank_statement") return "Bank statement";
  if (value === "cc_statement") return "CC statement";
  if (value === "invoice") return "Invoice";
  if (value === "general_doc") return "General doc";
  return value;
}

function isMicrosoftSourceDoc(doc: ProjectDoc): boolean {
  if (!ENABLE_MICROSOFT_INTEGRATION) return false;
  const metadata =
    doc.metadata && typeof doc.metadata === "object"
      ? (doc.metadata as Record<string, unknown>)
      : null;
  const driveId =
    metadata && isNonEmptyString(metadata.driveId) ? metadata.driveId : "";
  const itemId =
    metadata && isNonEmptyString(metadata.itemId) ? metadata.itemId : "";
  const sourceWebUrl =
    metadata && isNonEmptyString(metadata.sourceWebUrl)
      ? metadata.sourceWebUrl
      : "";
  const sourceLower = sourceWebUrl.toLowerCase();
  return (
    Boolean(driveId && itemId) ||
    sourceLower.includes("sharepoint.com") ||
    sourceLower.includes("onedrive")
  );
}

function isGoogleSourceDoc(doc: ProjectDoc): boolean {
  const metadata =
    doc.metadata && typeof doc.metadata === "object"
      ? (doc.metadata as Record<string, unknown>)
      : null;
  return Boolean(metadata?.googleFileId);
}

export function ProjectFilesViewer() {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    selectedProjectId,
    selectedProject,
    isLoading: isProjectLoading,
    needsFirstProject,
  } = useProjectSelector();
  const { trackUpload } = useUploadNotifications();
  const [ignoredDocIds, setIgnoredDocIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [askAboutDialog, setAskAboutDialog] = useState<{
    open: boolean;
    docIds: string[];
    docNames: string[];
  }>({ open: false, docIds: [], docNames: [] });
  const [previewDoc, setPreviewDoc] = useState<ProjectDoc | null>(null);

  // State for document type selection dialog
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [selectedDocType, setSelectedDocType] =
    useState<UploadDocumentType>("general_doc");

  // Local-only persistence per project.
  useEffect(() => {
    if (!selectedProjectId) {
      setIgnoredDocIds([]);
      return;
    }
    setIgnoredDocIds(readIgnoredDocIdsForProject(selectedProjectId));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    writeIgnoredDocIdsForProject(selectedProjectId, ignoredDocIds);
  }, [ignoredDocIds, selectedProjectId]);

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

  const { data: workflowAgentsData } = useSWR<{ agents: WorkflowAgent[] }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/workflow-agents`
      : null,
    fetcher
  );

  // Map of workflow agent ID to name for quick lookup
  const workflowAgentNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of workflowAgentsData?.agents ?? []) {
      map.set(agent.id, agent.name);
    }
    return map;
  }, [workflowAgentsData?.agents]);

  // Get MIME types of staged files
  const stagedFileMimeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const file of stagedFiles) {
      if (file.type) {
        types.add(file.type);
      }
    }
    return types;
  }, [stagedFiles]);

  const currentUserId = session?.user?.id ?? null;
  const role = useMemo(() => {
    if (!currentUserId) return null;
    const row = membersData?.members?.find(
      (m) => m.kind === "user" && m.userId === currentUserId
    );
    return row && row.kind === "user" ? row.role : null;
  }, [currentUserId, membersData?.members]);

  const isAdmin = role === "owner" || role === "admin";
  const msConnected = Boolean(msStatus?.connected);
  const googleConnected = Boolean(googleStatus?.connected);

  const toggleDocVisibility = (docId: string) => {
    setIgnoredDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const deleteDoc = (doc: ProjectDoc) => {
    if (!selectedProjectId) {
      toast.error("No project selected");
      return;
    }

    const deletePromise = fetch(
      `/api/projects/${selectedProjectId}/docs/${doc.id}`,
      {
        method: "DELETE",
      }
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
        setIgnoredDocIds((prev) => prev.filter((id) => id !== doc.id));
        void mutate();
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedProjectId) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!selectedProjectId) {
      toast.error("Please select a project first");
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Stage files and show document type selection dialog
    setStagedFiles(files);
    setSelectedDocType("general_doc");
  };

  const handleUploadStagedFiles = async (docType: UploadDocumentType) => {
    if (!selectedProjectId || stagedFiles.length === 0) return;

    const filesToUpload = [...stagedFiles];

    // Close dialog and reset state
    setStagedFiles([]);
    setSelectedDocType("general_doc");
    setIsUploading(true);

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", selectedProjectId);

        // Check if type is a workflow agent selection
        let effectiveDocType: string = docType;
        if (docType.startsWith("workflow:")) {
          const workflowAgentId = docType.slice("workflow:".length);
          effectiveDocType = "general_doc";
          formData.append("workflowAgentId", workflowAgentId);
        }
        formData.append("documentType", effectiveDocType);

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const json = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(json?.error ?? `Failed to upload ${file.name}`);
        }

        const data = await response.json();
        // Track upload for processing notification
        if (data?.doc?.id && data?.doc?.parseStatus === "pending") {
          trackUpload(data.doc.id, file.name, selectedProjectId);
        }

        return file.name;
      });

      await Promise.all(uploadPromises);
      toast.success(
        filesToUpload.length === 1
          ? `Uploaded ${filesToUpload[0].name}`
          : `Uploaded ${filesToUpload.length} files`
      );
      void mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload files"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const docs = data?.docs ?? [];

  // Filter docs based on search query and source filter
  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!doc.filename.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Source filter
      if (sourceFilter !== "all") {
        const isMicrosoft = isMicrosoftSourceDoc(doc);
        const isGoogle = isGoogleSourceDoc(doc);
        if (sourceFilter === "microsoft" && !isMicrosoft) return false;
        if (sourceFilter === "google" && !isGoogle) return false;
        if (sourceFilter === "uploaded" && (isMicrosoft || isGoogle))
          return false;
      }

      return true;
    });
  }, [docs, searchQuery, sourceFilter]);

  // Selection helpers
  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === filteredDocs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocs.map((d) => d.id)));
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedDocIds(new Set());
  };

  const openAskAboutSelected = () => {
    const selectedDocs = filteredDocs.filter((d) => selectedDocIds.has(d.id));
    setAskAboutDialog({
      open: true,
      docIds: selectedDocs.map((d) => d.id),
      docNames: selectedDocs.map((d) => d.filename),
    });
  };

  // Show full-screen project creation view if user has no (non-default) projects
  if (needsFirstProject) {
    return <FirstProjectPrompt />;
  }

  // Show loading state while waiting for project selection
  if (isProjectLoading || !selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-background">
        <Loader2Icon className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-background transition-colors",
        isDragging && "border-2 border-primary bg-primary/5"
      )}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-primary/10">
          <div className="rounded-lg border-2 border-primary border-dashed bg-background p-8 text-center">
            <UploadIcon className="mx-auto mb-4 h-12 w-12 text-primary" />
            <p className="font-medium text-lg text-primary">
              Drop files here to upload
            </p>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-3 border-border border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            value={searchQuery}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            onValueChange={(value) => setSourceFilter(value as SourceFilter)}
            value={sourceFilter}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="google">Google Drive</SelectItem>
              {ENABLE_MICROSOFT_INTEGRATION && (
                <SelectItem value="microsoft">Microsoft</SelectItem>
              )}
              <SelectItem value="uploaded">Uploaded</SelectItem>
            </SelectContent>
          </Select>
          {filteredDocs.length > 0 && (
            <Button
              onClick={() => {
                if (isSelectMode) {
                  exitSelectMode();
                } else {
                  setIsSelectMode(true);
                }
              }}
              size="sm"
              variant={isSelectMode ? "secondary" : "outline"}
            >
              {isSelectMode ? (
                <>
                  <X className="mr-1 h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <SparklesIcon size={16} />
                  <span className="ml-1">Ask about files</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {isLoading || isProjectLoading || !selectedProjectId ? (
        <div className="flex items-center justify-center py-10">
          <LoaderIcon className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredDocs.length === 0 && docs.length > 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          No documents match your search.
        </div>
      ) : docs.length > 0 ? (
        <div className="overflow-hidden">
          {/* Instructional banner when in select mode */}
          {isSelectMode && (
            <div className="flex items-center justify-between gap-3 border-border border-b bg-muted/30 px-4 py-2">
              <span className="text-muted-foreground text-sm">
                Select files to ask the AI about
              </span>
              <button
                className="flex items-center gap-2 text-muted-foreground text-xs hover:text-foreground"
                onClick={toggleSelectAll}
                title={
                  selectedDocIds.size === filteredDocs.length
                    ? "Deselect all"
                    : "Select all"
                }
                type="button"
              >
                {selectedDocIds.size === filteredDocs.length &&
                filteredDocs.length > 0 ? (
                  <div className="flex h-4 w-4 items-center justify-center rounded border border-primary bg-primary text-primary-foreground">
                    <CheckIcon className="h-3 w-3" />
                  </div>
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selectedDocIds.size === filteredDocs.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>
          )}
          {/* Table Header - hidden on mobile */}
          <div
            className={cn(
              "hidden border-border border-b bg-muted/30 px-4 py-2 text-muted-foreground text-xs sm:grid sm:gap-4",
              isSelectMode
                ? "sm:grid-cols-[32px_minmax(0,1fr)_110px_70px_80px_70px]"
                : "sm:grid-cols-[minmax(0,1fr)_110px_70px_80px_70px_160px]"
            )}
          >
            {/* Empty spacer for checkbox column alignment */}
            {isSelectMode && <div />}
            <div>Name</div>
            <div>Type</div>
            <div>Source</div>
            <div>Status</div>
            <div>Date</div>
            {!isSelectMode && <div className="text-right">Actions</div>}
          </div>

          <ScrollArea className="h-[60vh]">
            <div className="divide-y divide-border">
              {filteredDocs.map((doc) => {
                const isIgnored = ignoredDocIds.includes(doc.id);
                const metadata =
                  doc.metadata && typeof doc.metadata === "object"
                    ? (doc.metadata as Record<string, unknown>)
                    : null;
                const sourceWebUrl =
                  metadata && isNonEmptyString(metadata.sourceWebUrl)
                    ? metadata.sourceWebUrl
                    : "";
                const isMicrosoftSource = isMicrosoftSourceDoc(doc);
                const isGoogleSource = isGoogleSourceDoc(doc);

                const canDelete =
                  isAdmin ||
                  (currentUserId !== null && doc.createdBy === currentUserId);

                // Check if this doc is editable (only .md and .txt files)
                const isEditable = isEditableMimeType(doc.mimeType);
                const canEdit =
                  isEditable &&
                  (isAdmin ||
                    (currentUserId !== null &&
                      doc.createdBy === currentUserId));

                // Get workflow agent name if available
                const workflowAgentId =
                  metadata && isNonEmptyString(metadata.workflowAgentId)
                    ? metadata.workflowAgentId
                    : null;
                const displayDocType = workflowAgentId
                  ? workflowAgentNames.get(workflowAgentId) || doc.documentType
                  : doc.documentType;

                const isSelected = selectedDocIds.has(doc.id);

                return (
                  <div
                    className={cn(
                      "flex flex-col gap-2 px-4 py-3 text-sm hover:bg-muted/20 sm:grid sm:items-center sm:gap-4 sm:py-2",
                      isSelectMode
                        ? "cursor-pointer sm:grid-cols-[32px_minmax(0,1fr)_110px_70px_80px_70px]"
                        : "sm:grid-cols-[minmax(0,1fr)_110px_70px_80px_70px_160px]",
                      isSelected && "bg-primary/5"
                    )}
                    key={doc.id}
                    onClick={
                      isSelectMode
                        ? () => toggleDocSelection(doc.id)
                        : undefined
                    }
                  >
                    {/* Checkbox - only in select mode */}
                    {isSelectMode && (
                      <div className="flex items-center justify-center">
                        {isSelected ? (
                          <div className="flex h-4 w-4 items-center justify-center rounded border border-primary bg-primary text-primary-foreground">
                            <CheckIcon className="h-3 w-3" />
                          </div>
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    )}

                    {/* Name */}
                    <div className="min-w-0 overflow-hidden">
                      <button
                        className="block truncate text-left font-medium underline underline-offset-2 hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDoc(doc);
                        }}
                        title={doc.filename}
                        type="button"
                      >
                        {doc.filename}
                      </button>
                      {/* Mobile-only: show additional info inline */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs sm:hidden">
                        <span>{formatDocType(displayDocType)}</span>
                        <span>·</span>
                        {isGoogleSource ? (
                          <span className="flex items-center gap-1 text-google-drive">
                            <GoogleDriveIcon size={12} />
                            Google Drive
                          </span>
                        ) : isMicrosoftSource ? (
                          <span className="flex items-center gap-1 text-onedrive">
                            <OneDriveIcon size={12} />
                            Microsoft
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UploadIcon className="h-3 w-3" />
                            Uploaded
                          </span>
                        )}
                        <span>·</span>
                        <span>{format(new Date(doc.createdAt), "MMM d")}</span>
                      </div>
                    </div>

                    {/* Type - hidden on mobile */}
                    <div className="hidden truncate text-muted-foreground text-xs sm:block">
                      {formatDocType(displayDocType)}
                    </div>

                    {/* Source - hidden on mobile */}
                    <div className="hidden sm:block">
                      {isGoogleSource ? (
                        googleConnected && sourceWebUrl ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                className="text-google-drive"
                                href={sourceWebUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                <GoogleDriveIcon size={16} />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              Open in Google Drive
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-google-drive opacity-50">
                                <GoogleDriveIcon size={16} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {googleConnected
                                ? "Google Drive"
                                : "Connect Google Drive to open source file"}
                            </TooltipContent>
                          </Tooltip>
                        )
                      ) : isMicrosoftSource ? (
                        msConnected && sourceWebUrl ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                className="text-onedrive"
                                href={sourceWebUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                <OneDriveIcon size={16} />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              Open in SharePoint / OneDrive
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-onedrive opacity-50">
                                <OneDriveIcon size={16} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {msConnected
                                ? "SharePoint / OneDrive"
                                : "Connect Microsoft to open source file"}
                            </TooltipContent>
                          </Tooltip>
                        )
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <UploadIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Uploaded</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Status - hidden on mobile */}
                    <div className="hidden text-xs sm:block">
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
                          Review
                        </span>
                      )}
                    </div>

                    {/* Date - hidden on mobile */}
                    <div className="hidden text-muted-foreground text-xs sm:block">
                      {format(new Date(doc.createdAt), "MMM d")}
                    </div>

                    {/* Actions - hidden in select mode */}
                    {!isSelectMode && (
                      <div className="flex items-center justify-end gap-1">
                        {/* Ask about this document button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              className="h-8 w-8"
                              onClick={() => {
                                setAskAboutDialog({
                                  open: true,
                                  docIds: [doc.id],
                                  docNames: [doc.filename],
                                });
                              }}
                              size="icon"
                              title="Ask about this document"
                              type="button"
                              variant="ghost"
                            >
                              <MessageCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Ask about this document
                          </TooltipContent>
                        </Tooltip>

                        {/* View extracted JSON button */}
                        {doc.extractedJsonBlobUrl && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                asChild
                                className="h-8 w-8"
                                size="icon"
                                title="View extracted data"
                                variant="ghost"
                              >
                                <a
                                  href={doc.extractedJsonBlobUrl}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  <FileJson2Icon className="h-4 w-4 text-green-600" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              View extracted data (JSON)
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Edit button for .md/.txt files */}
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                className="h-8 w-8"
                                onClick={() =>
                                  router.push(`/files/docs/${doc.id}`)
                                }
                                size="icon"
                                title="Edit document"
                                type="button"
                                variant="ghost"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Edit document
                            </TooltipContent>
                          </Tooltip>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              className="h-8 w-8"
                              onClick={() => toggleDocVisibility(doc.id)}
                              size="icon"
                              title={
                                isIgnored
                                  ? "Show in context"
                                  : "Hide from context"
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
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {isIgnored
                              ? "Show in context"
                              : "Hide from context"}
                          </TooltipContent>
                        </Tooltip>

                        {isGoogleSource ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  className="h-8 w-8"
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
                                  className="h-8 w-8"
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

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                className="h-8 w-8"
                                disabled={!canDelete}
                                onClick={() => deleteDoc(doc)}
                                size="icon"
                                title={
                                  canDelete
                                    ? "Delete document"
                                    : "Only admins can delete this"
                                }
                                type="button"
                                variant="ghost"
                              >
                                <Trash2Icon className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {canDelete ? (
                            <TooltipContent side="top">
                              Delete document
                            </TooltipContent>
                          ) : (
                            <TooltipContent side="top">
                              Only admins can delete documents added by others.
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Floating Action Bar - shown when items are selected */}
            {isSelectMode && selectedDocIds.size > 0 && (
              <div className="sticky bottom-0 border-border border-t bg-background p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground text-sm">
                    {selectedDocIds.size}{" "}
                    {selectedDocIds.size === 1 ? "file" : "files"} selected
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => setSelectedDocIds(new Set())}
                      size="sm"
                      variant="outline"
                    >
                      Clear
                    </Button>
                    <Button onClick={openAskAboutSelected} size="sm">
                      <MessageCircle className="mr-1 h-4 w-4" />
                      Ask about selected
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Section inside ScrollArea */}
            <div className="border-border border-t p-4">
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed bg-muted/30 py-6 transition-colors hover:border-primary/50 hover:bg-muted/50",
                  isUploading && "pointer-events-none opacity-50"
                )}
              >
                <input
                  accept="*/*"
                  className="hidden"
                  disabled={isUploading}
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;

                    // Stage files and show document type selection dialog
                    setStagedFiles(files);
                    setSelectedDocType("general_doc");

                    // Reset input so same file can be selected again
                    e.target.value = "";
                  }}
                  type="file"
                />
                {isUploading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <LoaderIcon className="h-5 w-5 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <>
                    <UploadIcon className="mb-2 h-6 w-6 text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">
                      Click to upload or drag and drop files
                    </span>
                  </>
                )}
              </label>
            </div>
          </ScrollArea>
        </div>
      ) : null}

      {/* Upload Section - shown when no docs */}
      {selectedProjectId &&
        !isLoading &&
        !isProjectLoading &&
        docs.length === 0 && (
          <div className="p-4">
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-muted-foreground/25 border-dashed bg-muted/30 py-6 transition-colors hover:border-primary/50 hover:bg-muted/50",
                isUploading && "pointer-events-none opacity-50"
              )}
            >
              <input
                accept="*/*"
                className="hidden"
                disabled={isUploading}
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;

                  // Stage files and show document type selection dialog
                  setStagedFiles(files);
                  setSelectedDocType("general_doc");

                  // Reset input so same file can be selected again
                  e.target.value = "";
                }}
                type="file"
              />
              {isUploading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LoaderIcon className="h-5 w-5 animate-spin" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <>
                  <UploadIcon className="mb-2 h-6 w-6 text-muted-foreground" />
                  <span className="mb-1 text-muted-foreground text-sm">
                    No documents found for this project.
                  </span>
                  <span className="text-muted-foreground text-sm">
                    Click to upload or drag and drop files
                  </span>
                </>
              )}
            </label>
          </div>
        )}

      {/* Document Type Selection Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setStagedFiles([]);
            setSelectedDocType("general_doc");
          }
        }}
        open={stagedFiles.length > 0}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Document Type</DialogTitle>
            <DialogDescription>
              Choose a document type for the {stagedFiles.length} file
              {stagedFiles.length !== 1 ? "s" : ""} you selected.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <DocumentTypePicker
              fileCount={stagedFiles.length}
              mimeTypeFilter={
                stagedFileMimeTypes.size === 1
                  ? [...stagedFileMimeTypes][0]
                  : null
              }
              onCancel={() => setStagedFiles([])}
              onSelect={(selection) => {
                if (selection.isWorkflow) {
                  void handleUploadStagedFiles(`workflow:${selection.id}`);
                } else {
                  void handleUploadStagedFiles("general_doc");
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AskAboutDialog
        docIds={askAboutDialog.docIds}
        docNames={askAboutDialog.docNames}
        onOpenChange={(open) => {
          setAskAboutDialog((prev) => ({ ...prev, open }));
          if (!open) {
            exitSelectMode();
          }
        }}
        open={askAboutDialog.open}
      />

      <FilePreviewDialog
        doc={previewDoc}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDoc(null);
          }
        }}
        open={previewDoc !== null}
      />
    </div>
  );
}
