"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useProjectSelector } from "@/hooks/use-project-selector";
import type { TaskPriority } from "@/lib/db/queries";
import type { ProjectDoc } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

type GeneratedTask = {
  title: string;
  description?: string;
  priority: TaskPriority;
  startDate?: string;
  endDate?: string;
};

type GeneratedTaskWithState = GeneratedTask & {
  id: string;
  selected: boolean;
  expanded: boolean;
};

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  urgent: { label: "Urgent", className: "task-priority-urgent" },
  high: { label: "High", className: "task-priority-high" },
  medium: { label: "Medium", className: "task-priority-medium" },
  low: { label: "Low", className: "task-priority-low" },
};

type GenerateTasksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTasksCreated?: () => void;
};

type InputMode = "documents" | "paste";

export function GenerateTasksDialog({
  open,
  onOpenChange,
  onTasksCreated,
}: GenerateTasksDialogProps) {
  const { selectedProjectId } = useProjectSelector();

  // Step management
  const [step, setStep] = useState<"select" | "review">("select");

  // Input mode toggle
  const [inputMode, setInputMode] = useState<InputMode>("documents");

  // Document selection
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  // Pasted content
  const [pastedContent, setPastedContent] = useState("");

  // Generated tasks
  const [generatedTasks, setGeneratedTasks] = useState<
    GeneratedTaskWithState[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Global assignee for all tasks
  const [globalAssigneeId, setGlobalAssigneeId] = useState<string | null>(null);

  // Fetch project members
  const { data: membersData } = useSWR<{
    members: Array<{ kind: string; userId?: string; email: string }>;
  }>(
    selectedProjectId && open
      ? `/api/projects/${selectedProjectId}/members`
      : null,
    fetcher
  );
  const members = (membersData?.members ?? []).filter(
    (m): m is { kind: string; userId: string; email: string } =>
      m.userId !== undefined
  );

  // Fetch documents
  const { data: docsData, isLoading: isLoadingDocs } = useSWR<{
    docs: ProjectDoc[];
  }>(
    selectedProjectId && open
      ? `/api/projects/${selectedProjectId}/docs`
      : null,
    fetcher
  );

  // Filter to text-based documents only
  const docs = (docsData?.docs ?? []).filter(
    (doc) =>
      ["text/plain", "text/markdown", "application/pdf"].includes(
        doc.mimeType
      ) || doc.documentType === "note"
  );

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

  const handleGenerate = async () => {
    // Validate based on input mode
    if (!selectedProjectId) {
      return;
    }
    if (inputMode === "documents" && selectedDocIds.size === 0) {
      return;
    }
    if (inputMode === "paste" && !pastedContent.trim()) {
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/tasks/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceDocIds:
              inputMode === "documents" ? [...selectedDocIds] : undefined,
            pastedContent:
              inputMode === "paste" ? pastedContent.trim() : undefined,
          }),
        }
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to generate tasks");
      }

      const { generatedTasks: tasks } = await response.json();

      if (!tasks || tasks.length === 0) {
        toast.info("No actionable tasks found in the selected documents");
        return;
      }

      // Add state to each task
      const tasksWithState: GeneratedTaskWithState[] = tasks.map(
        (task: GeneratedTask, index: number) => ({
          ...task,
          id: `gen-${index}-${Date.now()}`,
          selected: true,
          expanded: false,
        })
      );

      setGeneratedTasks(tasksWithState);
      setStep("review");
      toast.success(
        `Generated ${tasks.length} task${tasks.length === 1 ? "" : "s"}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate tasks"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTasks = async () => {
    if (!selectedProjectId) {
      return;
    }

    const selectedTasks = generatedTasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) {
      toast.error("Please select at least one task to create");
      return;
    }

    setIsCreating(true);
    try {
      // Create each task
      const sourceDocId =
        inputMode === "documents" ? [...selectedDocIds].at(0) : undefined;
      const createPromises = selectedTasks.map((task) =>
        fetch(`/api/projects/${selectedProjectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            priority: task.priority,
            startDate: task.startDate,
            endDate: task.endDate,
            sourceDocId, // Link to first source doc if from documents mode
            assigneeId: globalAssigneeId ?? undefined,
          }),
        }).then((r) => {
          if (!r.ok) {
            throw new Error("Failed to create task");
          }
          return r.json();
        })
      );

      await Promise.all(createPromises);

      toast.success(
        `Created ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}`
      );
      onOpenChange(false);
      onTasksCreated?.();

      // Reset state
      setStep("select");
      setInputMode("documents");
      setSelectedDocIds(new Set());
      setPastedContent("");
      setGeneratedTasks([]);
      setGlobalAssigneeId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create tasks"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setGeneratedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, selected: !t.selected } : t))
    );
  };

  const toggleTaskExpanded = (taskId: string) => {
    setGeneratedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, expanded: !t.expanded } : t))
    );
  };

  const updateTask = (taskId: string, updates: Partial<GeneratedTask>) => {
    setGeneratedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  };

  const removeTask = (taskId: string) => {
    setGeneratedTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep("select");
      setInputMode("documents");
      setSelectedDocIds(new Set());
      setPastedContent("");
      setGeneratedTasks([]);
      setGlobalAssigneeId(null);
    }, 200);
  };

  const selectedCount = generatedTasks.filter((t) => t.selected).length;

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {step === "select"
              ? "Generate Tasks from Documents"
              : "Review Generated Tasks"}
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Select documents or paste content to extract actionable tasks from."
              : "Review and edit the generated tasks before creating them."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <>
            {/* Input mode toggle */}
            <div className="flex gap-2 rounded-lg border border-border p-1">
              <button
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                  inputMode === "documents"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setInputMode("documents")}
                type="button"
              >
                <FileText className="mr-1.5 inline-block h-4 w-4" />
                Select Documents
              </button>
              <button
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                  inputMode === "paste"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setInputMode("paste")}
                type="button"
              >
                <FileText className="mr-1.5 inline-block h-4 w-4" />
                Paste Content
              </button>
            </div>

            {inputMode === "documents" ? (
              <ScrollArea className="h-[250px] rounded-md border border-border p-2">
                {isLoadingDocs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-muted-foreground" />
                  </div>
                ) : docs.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No text documents found in this project.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {docs.map((doc) => (
                      <div
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent",
                          selectedDocIds.has(doc.id) && "bg-accent"
                        )}
                        key={doc.id}
                        onClick={() => toggleDocSelection(doc.id)}
                      >
                        <Checkbox
                          checked={selectedDocIds.has(doc.id)}
                          onCheckedChange={() => toggleDocSelection(doc.id)}
                        />
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">
                          {doc.description || doc.filename}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            ) : (
              <div>
                <label className="mb-1.5 block font-medium text-sm">
                  Paste transcript, notes, or any content
                </label>
                <Textarea
                  className="resize-none"
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Paste meeting transcript, notes, emails, or any content with action items..."
                  rows={8}
                  value={pastedContent}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Global assignee selector */}
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Assign all tasks to:</span>
              <Select
                onValueChange={(v) =>
                  setGlobalAssigneeId(v === "unassigned" ? null : v)
                }
                value={globalAssigneeId ?? "unassigned"}
              >
                <SelectTrigger className="h-8 w-48">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[350px]">
              <div className="space-y-2 pr-4">
                {generatedTasks.map((task) => (
                  <div
                    className={cn(
                      "rounded-lg border border-border p-3 transition-colors",
                      !task.selected && "opacity-50"
                    )}
                    key={task.id}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.selected}
                        className="mt-1"
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-auto border-none p-0 font-medium text-sm shadow-none focus-visible:ring-0"
                            onChange={(e) =>
                              updateTask(task.id, { title: e.target.value })
                            }
                            value={task.title}
                          />
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-xs",
                              PRIORITY_CONFIG[task.priority].className
                            )}
                          >
                            {PRIORITY_CONFIG[task.priority].label}
                          </span>
                        </div>

                        {task.expanded && (
                          <div className="mt-3 space-y-3">
                            <Textarea
                              className="text-sm"
                              onChange={(e) =>
                                updateTask(task.id, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Description..."
                              rows={2}
                              value={task.description ?? ""}
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="mb-1 block text-muted-foreground text-xs">
                                  Priority
                                </label>
                                <Select
                                  onValueChange={(v) =>
                                    updateTask(task.id, {
                                      priority: v as TaskPriority,
                                    })
                                  }
                                  value={task.priority}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(PRIORITY_CONFIG).map(
                                      ([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                          {config.label}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="mb-1 block text-muted-foreground text-xs">
                                  Start Date
                                </label>
                                <Input
                                  className="h-8 text-xs"
                                  onChange={(e) =>
                                    updateTask(task.id, {
                                      startDate: e.target.value || undefined,
                                    })
                                  }
                                  type="date"
                                  value={task.startDate ?? ""}
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-muted-foreground text-xs">
                                  Due Date
                                </label>
                                <Input
                                  className="h-8 text-xs"
                                  onChange={(e) =>
                                    updateTask(task.id, {
                                      endDate: e.target.value || undefined,
                                    })
                                  }
                                  type="date"
                                  value={task.endDate ?? ""}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          className="h-7 w-7"
                          onClick={() => toggleTaskExpanded(task.id)}
                          size="icon"
                          variant="ghost"
                        >
                          {task.expanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeTask(task.id)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {generatedTasks.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                    <p>All tasks have been removed.</p>
                    <Button
                      className="mt-2"
                      onClick={() => setStep("select")}
                      variant="link"
                    >
                      Go back and try again
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "review" && (
            <Button onClick={() => setStep("select")} variant="outline">
              Back
            </Button>
          )}
          <Button onClick={handleClose} variant="outline">
            Cancel
          </Button>
          {step === "select" ? (
            <Button
              disabled={
                isGenerating ||
                (inputMode === "documents" && selectedDocIds.size === 0) ||
                (inputMode === "paste" && !pastedContent.trim())
              }
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  Generate Tasks
                </>
              )}
            </Button>
          ) : (
            <Button
              disabled={selectedCount === 0 || isCreating}
              onClick={handleCreateTasks}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Create {selectedCount} Task{selectedCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
