"use client";

import {
  ArrowLeft,
  Check,
  Cloud,
  CloudOff,
  ExternalLink,
  Eye,
  LoaderIcon,
  Pencil,
  RefreshCw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import useSWR from "swr";
import { ProjectSwitcher } from "@/components/project-switcher";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { ENABLE_MICROSOFT_INTEGRATION } from "@/lib/constants";
import type { ProjectDoc } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

type DocWithContent = ProjectDoc & {
  content: string;
  isMicrosoftDoc: boolean;
  microsoftMetadata?: {
    driveId: string;
    itemId: string;
    lastModifiedDateTime?: string;
    sourceWebUrl?: string;
  } | null;
};

type SyncStatus = "synced" | "syncing" | "error" | "pending" | "not-applicable";

export function EditableDoc({ docId }: { docId: string }) {
  const { selectedProjectId, isLoading: isProjectLoading } =
    useProjectSelector();
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("not-applicable");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  const {
    data,
    isLoading: isDataLoading,
    error,
    mutate,
  } = useSWR<{ doc: DocWithContent }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/docs/${docId}`
      : null,
    fetcher
  );

  useEffect(() => {
    if (data?.doc) {
      setContent(data.doc.content || "");
      setHasChanges(false);
      setJustSaved(false);

      // Determine sync status from metadata
      const metadata = data.doc.metadata as Record<string, unknown> | null;
      if (data.doc.isMicrosoftDoc) {
        if (metadata?.syncError) {
          setSyncStatus("error");
        } else if (metadata?.lastSyncedToSharePoint) {
          setSyncStatus("synced");
        } else if (metadata?.lastLocalEdit) {
          setSyncStatus("pending");
        } else {
          setSyncStatus("synced");
        }
      } else {
        setSyncStatus("not-applicable");
      }
    }
  }, [data]);

  const handleSave = useCallback(async () => {
    if (!selectedProjectId || isSaving) return;

    setIsSaving(true);
    if (data?.doc.isMicrosoftDoc) {
      setSyncStatus("syncing");
    }

    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/docs/${docId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to save");
      }

      const result = await response.json();
      setHasChanges(false);
      setJustSaved(true);

      if (result.doc?.syncQueued) {
        setSyncStatus("syncing");
        toast.info("Syncing to SharePoint...");

        // Poll for sync completion
        setTimeout(async () => {
          await mutate();
        }, 3000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      if (data?.doc.isMicrosoftDoc) {
        setSyncStatus("error");
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedProjectId,
    docId,
    content,
    isSaving,
    data?.doc.isMicrosoftDoc,
    mutate,
  ]);

  // Keyboard shortcut: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges && !isSaving) {
          handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasChanges, isSaving, handleSave]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
    setJustSaved(false);
  };

  const handleRefreshSyncStatus = async () => {
    await mutate();
    toast.success("Sync status refreshed");
  };

  if (isDataLoading || isProjectLoading || !selectedProjectId) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <LoaderIcon className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.doc) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Document not found</p>
        <Button asChild variant="outline">
          <Link href="/files">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Files
          </Link>
        </Button>
      </div>
    );
  }

  const doc = data.doc;
  const metadata = doc.metadata as Record<string, unknown> | null;
  const sourceWebUrl = doc.microsoftMetadata?.sourceWebUrl;

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-border border-b bg-background px-2 py-1.5 md:px-4">
        <SidebarToggle />
        <ProjectSwitcher />

        <Button asChild className="gap-1.5" size="sm" variant="ghost">
          <Link href="/files">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {/* Sync status indicator for Microsoft docs */}
          {doc.isMicrosoftDoc && (
            <div className="flex items-center gap-1.5">
              {syncStatus === "synced" && (
                <span className="flex items-center gap-1 text-green-600 text-xs">
                  <Cloud className="h-3 w-3" />
                  Synced
                </span>
              )}
              {syncStatus === "syncing" && (
                <span className="flex items-center gap-1 text-blue-600 text-xs">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing...
                </span>
              )}
              {syncStatus === "pending" && (
                <span className="flex items-center gap-1 text-xs text-yellow-600">
                  <Cloud className="h-3 w-3" />
                  Pending sync
                </span>
              )}
              {syncStatus === "error" && (
                <button
                  className="flex items-center gap-1 text-red-600 text-xs hover:underline"
                  onClick={handleRefreshSyncStatus}
                  title={`Sync error: ${metadata?.syncError || "Unknown error"}. Click to refresh.`}
                  type="button"
                >
                  <CloudOff className="h-3 w-3" />
                  Sync failed
                </button>
              )}
            </div>
          )}

          {/* Open in SharePoint link */}
          {ENABLE_MICROSOFT_INTEGRATION && sourceWebUrl && (
            <Button asChild size="sm" variant="ghost">
              <a
                className="gap-1"
                href={sourceWebUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="hidden sm:inline">Open in SharePoint</span>
              </a>
            </Button>
          )}

          {hasChanges ? (
            <span className="text-muted-foreground text-xs">Unsaved</span>
          ) : justSaved ? (
            <span className="flex items-center gap-1 text-green-600 text-xs">
              <Check className="h-3 w-3" />
              Saved
            </span>
          ) : null}

          <Button
            disabled={isSaving || !hasChanges}
            onClick={handleSave}
            size="sm"
          >
            {isSaving ? (
              <LoaderIcon className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Edit/Preview Toggle */}
        <div className="flex items-center gap-2 border-border border-b px-4 py-2">
          <div className="m-1 flex overflow-hidden rounded-md border border-border">
            <button
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 font-medium text-xs transition-colors",
                viewMode === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("edit")}
              type="button"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 font-medium text-xs transition-colors",
                viewMode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("preview")}
              type="button"
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        </div>

        <div className="border-border border-b px-4 py-3">
          <h1 className="font-semibold text-lg">{doc.filename}</h1>
          {doc.description && (
            <p className="text-muted-foreground text-sm">{doc.description}</p>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {viewMode === "edit" ? (
            <textarea
              className="h-full w-full resize-none rounded-md border border-border bg-transparent p-3 font-mono text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
              id="doc-content"
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start writing..."
              style={{ minHeight: "calc(100vh - 200px)" }}
              value={content}
            />
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-border bg-transparent p-4"
              style={{ minHeight: "calc(100vh - 200px)" }}
            >
              {content ? (
                <Streamdown controls={{ mermaid: true }}>{content}</Streamdown>
              ) : (
                <p className="text-muted-foreground italic">
                  No content to preview
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
