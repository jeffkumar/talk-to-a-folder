"use client";

import { format } from "date-fns";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ShareProjectDialog } from "@/components/share-project-dialog";
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
import { Input } from "@/components/ui/input";
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
import type { ProjectDoc } from "@/lib/db/schema";
import { namespacesForSourceTypes } from "@/lib/rag/source-routing";
import { fetcher } from "@/lib/utils";

function formatProjectDate(value: unknown) {
  if (value instanceof Date) {
    return format(value, "PPpp");
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return format(date, "PPpp");
  }
  return "—";
}

function tailWithEllipsis(value: string, tailChars = 16) {
  if (value.length <= tailChars) {
    return value;
  }
  return `…${value.slice(-tailChars)}`;
}

function ValueWithTooltip({
  displayValue,
  fullValue,
  className,
}: {
  displayValue: string;
  fullValue: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className} title={fullValue}>
          {displayValue}
        </span>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-[420px] whitespace-normal break-all"
        side="top"
      >
        {fullValue}
      </TooltipContent>
    </Tooltip>
  );
}

export function ProjectDetails({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedProject, selectedProjectId, mutate, setSelectedProjectId } =
    useProjectSelector();
  const projectName = selectedProject?.name ?? "";
  const hideName =
    typeof projectName === "string" &&
    projectName.trim().toLowerCase() === "default";

  const docsNamespace = selectedProject?.id
    ? namespacesForSourceTypes(
        ["docs"],
        selectedProject.id,
        selectedProject.isDefault
      )[0]
    : "—";

  const { data, isLoading } = useSWR<{ docs: ProjectDoc[] }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/docs` : null,
    fetcher
  );

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const handleStartEditName = () => {
    setEditedName(selectedProject?.name ?? "");
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  const handleSaveName = async () => {
    if (!selectedProjectId) return;

    const trimmedName = editedName.trim();
    if (trimmedName.length === 0) {
      toast.error("Project name cannot be empty");
      return;
    }

    setIsSavingName(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update project name");
      }

      toast.success("Project name updated");
      mutate();
      setIsEditingName(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update project name"
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProjectId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      toast.success("Project deleted");
      onOpenChange(false);
      setSelectedProjectId(null); // Will trigger auto-selection of default
      mutate();
    } catch (_error) {
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Sheet onOpenChange={onOpenChange} open={isOpen}>
        <SheetContent
          className="flex w-[400px] flex-col sm:w-[540px]"
          side="right"
        >
          <SheetHeader>
            <SheetTitle>Project Details</SheetTitle>
            <SheetDescription>
              Details for the currently selected project.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4 text-sm">
            {!hideName && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  Name
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      className="h-8 flex-1 text-sm"
                      disabled={isSavingName}
                      maxLength={200}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveName();
                        } else if (e.key === "Escape") {
                          handleCancelEditName();
                        }
                      }}
                      value={editedName}
                    />
                    <Button
                      className="h-8 w-8"
                      disabled={isSavingName}
                      onClick={handleSaveName}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-8 w-8"
                      disabled={isSavingName}
                      onClick={handleCancelEditName}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="break-words font-medium">
                      {selectedProject?.name ?? "—"}
                    </span>
                    {!selectedProject?.isDefault && (
                      <Button
                        className="h-6 w-6 shrink-0"
                        onClick={handleStartEditName}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                Project ID
              </span>
              {selectedProject?.id ? (
                <ValueWithTooltip
                  className="block break-all font-mono text-xs"
                  displayValue={selectedProject.id}
                  fullValue={selectedProject.id}
                />
              ) : (
                <span className="block font-mono text-xs">—</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  Default
                </span>
                <span className="block">
                  {selectedProject?.isDefault ? "Yes" : "No"}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  Documents
                </span>
                <span className="block">
                  {isLoading
                    ? "Loading…"
                    : (data?.docs?.length ?? 0).toString()}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                Created
              </span>
              <span className="block">
                {formatProjectDate(selectedProject?.createdAt)}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                Docs Namespace
              </span>
              {docsNamespace !== "—" ? (
                <ValueWithTooltip
                  className="block break-all font-mono text-xs"
                  displayValue={docsNamespace}
                  fullValue={docsNamespace}
                />
              ) : (
                <span className="block font-mono text-xs">—</span>
              )}
            </div>
          </div>

          <div className="mt-auto pt-6">
            {selectedProjectId && (
              <Button
                className="mb-2 w-full"
                onClick={() => setIsShareOpen(true)}
                type="button"
                variant="outline"
              >
                Share Project
              </Button>
            )}
            {!selectedProject?.isDefault && (
              <Button
                className="w-full"
                onClick={() => setShowDeleteDialog(true)}
                type="button"
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot
              be undone and will delete all associated files and chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={handleDeleteProject}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedProjectId && (
        <ShareProjectDialog
          onOpenChange={setIsShareOpen}
          open={isShareOpen}
          projectId={selectedProjectId}
        />
      )}
    </>
  );
}
