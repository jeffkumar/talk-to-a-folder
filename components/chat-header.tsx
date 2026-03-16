"use client";
import {
  CheckSquare,
  Cpu,
  FileText,
  FolderCog,
  MessageSquareWarning,
  Plug2,
  Settings,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, startTransition, useState } from "react";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ProjectDetails } from "@/components/project-details";
import { ProjectSwitcher } from "@/components/project-switcher";
import { ShareProjectDialog } from "@/components/share-project-dialog";
import { SidebarToggle } from "@/components/sidebar-toggle";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { useDeleteChats } from "@/hooks/use-delete-chats";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { chatModels } from "@/lib/ai/models";
import type { VisibilityType } from "@/lib/types";
import { CheckCircleFillIcon, PlusIcon } from "./icons";

export type RetrievalRangePreset = "all" | "1d" | "7d" | "30d" | "90d";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  ignoredDocIds,
  setIgnoredDocIds,
  selectedModelId,
  onModelChange,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  ignoredDocIds: string[];
  setIgnoredDocIds: (ids: string[]) => void;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}) {
  const router = useRouter();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isProjectDetailsOpen, setIsProjectDetailsOpen] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const { selectedProjectId, selectedProject } = useProjectSelector();
  const { open, openMobile, isMobile } = useSidebar();
  const isSidebarVisible = isMobile ? openMobile : open;
  const { deleteAllChats } = useDeleteChats();

  const selectedModel = chatModels.find((m) => m.id === selectedModelId);

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />
      <ProjectSwitcher />

      {!isSidebarVisible && (
        <Button
          className="new-chat-button h-8 gap-1.5 px-3"
          onClick={() => {
            router.push("/chat");
          }}
          type="button"
          variant="outline"
        >
          <PlusIcon />
          <span className="text-xs">New Chat</span>
        </Button>
      )}

      {!isReadonly && (
        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          <Button
            disabled={!selectedProjectId}
            onClick={() => setIsShareOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="gap-1"
                size="sm"
                type="button"
                variant="outline"
              >
                <Settings className="text-muted-foreground" size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <div className="px-2 pb-2 text-muted-foreground text-xs">
                Configure documents for this chat.
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!selectedProjectId}
                onClick={() => setIsProjectDetailsOpen(true)}
              >
                <FolderCog className="mr-2 h-4 w-4" />
                Project Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/files">
                  <FileText className="mr-2 h-4 w-4" />
                  Files
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/files/tasks">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Tasks
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/integrations">
                  <Plug2 className="mr-2 h-4 w-4" />
                  Integrations
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {selectedModelId && onModelChange && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Cpu className="mr-2 h-4 w-4" />
                    Model: {selectedModel?.name ?? "Select"}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="min-w-[220px]">
                      {chatModels.map((model) => (
                        <DropdownMenuItem
                          key={model.id}
                          onSelect={() => {
                            startTransition(() => {
                              onModelChange(model.id);
                              saveChatModelAsCookie(model.id);
                            });
                          }}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm">{model.name}</span>
                              <span className="text-muted-foreground text-xs">
                                {model.description}
                              </span>
                            </div>
                            {model.id === selectedModelId && (
                              <CheckCircleFillIcon size={16} />
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <FeedbackDialog
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <MessageSquareWarning className="mr-2 h-4 w-4" />
                    Send Feedback
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!selectedProjectId}
                onClick={() => setShowDeleteProjectDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete project chats
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog
            onOpenChange={setShowDeleteProjectDialog}
            open={showDeleteProjectDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete all chats for {selectedProject?.name ?? "this project"}
                  ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all
                  chats in this project and remove them from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteAllChats(selectedProjectId ?? undefined);
                    setShowDeleteProjectDialog(false);
                  }}
                >
                  Delete All
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
          <ProjectDetails
            isOpen={isProjectDetailsOpen}
            onOpenChange={setIsProjectDetailsOpen}
          />
        </div>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.ignoredDocIds === nextProps.ignoredDocIds &&
    prevProps.selectedModelId === nextProps.selectedModelId
  );
});
