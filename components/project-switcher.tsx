"use client";

import { Check, ChevronDown, Folder, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import * as React from "react";
import { toast } from "sonner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { cn } from "@/lib/utils";
import { CreateProjectDialog } from "./create-project-dialog";

type RemoveAction = {
  projectId: string;
  projectName: string;
  isOwnerOrAdmin: boolean;
};

export function ProjectSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const {
    projects: allProjects,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    mutate,
    needsFirstProject,
  } = useProjectSelector();

  // Filter out default projects from the dropdown
  const projects = allProjects.filter((p) => !p.isDefault);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [removeAction, setRemoveAction] = React.useState<RemoveAction | null>(
    null
  );

  // If user needs to create first project (or only has default projects), show a simplified button
  if (needsFirstProject || projects.length === 0) {
    return (
      <>
        <Button
          className={cn("w-[200px] justify-between px-2", className)}
          onClick={() => setShowCreateDialog(true)}
          variant="outline"
        >
          <div className="flex items-center gap-2 truncate">
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">
              Create project...
            </span>
          </div>
          <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        <CreateProjectDialog
          onOpenChange={setShowCreateDialog}
          open={showCreateDialog}
        />
      </>
    );
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      toast.success("Project deleted");
      mutate();

      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
    } catch (_error) {
      toast.error("Failed to delete project");
    } finally {
      setRemoveAction(null);
    }
  };

  const handleLeaveProject = async (projectId: string) => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/members/${session.user.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to leave project");
      }

      toast.success("Left project");
      mutate();

      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
    } catch (_error) {
      toast.error("Failed to leave project");
    } finally {
      setRemoveAction(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn("w-[200px] justify-between px-2", className)}
            variant="outline"
          >
            <div className="flex items-center gap-2 truncate">
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedProject && !selectedProject.isDefault
                  ? selectedProject.name
                  : "Select project..."}
              </span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup className="max-h-[200px] overflow-y-auto">
            {projects.map((project) => (
              <DropdownMenuItem
                className="group cursor-pointer justify-between"
                key={project.id}
                onSelect={() => {
                  // Only act if changing to a different project
                  if (selectedProjectId !== project.id) {
                    setSelectedProjectId(project.id);
                    // Always navigate to new chat when switching projects
                    if (pathname === "/chat" || pathname.startsWith("/chat/")) {
                      router.push("/chat");
                      router.refresh();
                    }
                  }
                }}
              >
                <div className="flex items-center truncate">
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      selectedProjectId === project.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span className="truncate">{project.name}</span>
                </div>
                <div
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const isOwnerOrAdmin =
                      project.role === "owner" || project.role === "admin";
                    setRemoveAction({
                      projectId: project.id,
                      projectName: project.name,
                      isOwnerOrAdmin,
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      const isOwnerOrAdmin =
                        project.role === "owner" || project.role === "admin";
                      setRemoveAction({
                        projectId: project.id,
                        projectName: project.name,
                        isOwnerOrAdmin,
                      });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <Trash2 className="h-3 w-3" />
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateProjectDialog
        onOpenChange={setShowCreateDialog}
        open={showCreateDialog}
      />
      <AlertDialog
        onOpenChange={(open) => !open && setRemoveAction(null)}
        open={!!removeAction}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeAction?.isOwnerOrAdmin
                ? "Delete Project"
                : "Leave Project"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removeAction?.isOwnerOrAdmin
                ? `Are you sure you want to delete "${removeAction.projectName}"? This action cannot be undone and will affect all users in this project. All associated files and chats will be permanently deleted.`
                : `Are you sure you want to remove yourself from "${removeAction?.projectName}"? You will no longer have access to this project.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (!removeAction) return;
                if (removeAction.isOwnerOrAdmin) {
                  handleDeleteProject(removeAction.projectId);
                } else {
                  handleLeaveProject(removeAction.projectId);
                }
              }}
            >
              {removeAction?.isOwnerOrAdmin ? "Delete" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
