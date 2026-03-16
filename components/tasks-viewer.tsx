"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { FirstProjectPrompt } from "@/components/first-project-prompt";
import { GenerateTasksDialog } from "@/components/generate-tasks-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectSelector } from "@/hooks/use-project-selector";
import type {
  TaskPriority,
  TaskStatus,
  TaskWithAssignee,
} from "@/lib/db/queries";
import { cn, fetcher } from "@/lib/utils";

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: typeof Circle; className: string }
> = {
  todo: {
    label: "To Do",
    icon: Circle,
    className: "task-status-todo",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "task-status-in-progress",
  },
  in_review: {
    label: "In Review",
    icon: AlertCircle,
    className: "task-status-in-review",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "task-status-completed",
  },
  cancelled: {
    label: "Cancelled",
    icon: X,
    className: "task-status-cancelled",
  },
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

export function TasksViewer() {
  const router = useRouter();
  const {
    selectedProjectId,
    selectedProject,
    isLoading: isProjectLoading,
    needsFirstProject,
  } = useProjectSelector();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] =
    useState<TaskPriority>("medium");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string | null>(
    null
  );
  const [newTaskStartDate, setNewTaskStartDate] = useState("");
  const [newTaskEndDate, setNewTaskEndDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">(
    "all"
  );

  const { data, isLoading, mutate } = useSWR<{ tasks: TaskWithAssignee[] }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/tasks` : null,
    fetcher
  );

  const { data: membersData } = useSWR<{
    members: Array<{ kind: string; userId?: string; email: string }>;
  }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/members` : null,
    fetcher
  );

  const members = (membersData?.members ?? [])
    .filter(
      (m): m is { kind: string; userId: string; email: string } =>
        m.kind === "user" && typeof m.userId === "string"
    )
    .map((m) => ({ userId: m.userId, email: m.email }));

  const handleCreateTask = async () => {
    if (!selectedProjectId || !newTaskTitle.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || undefined,
          priority: newTaskPriority,
          assigneeId: newTaskAssigneeId || undefined,
          startDate: newTaskStartDate || undefined,
          endDate: newTaskEndDate || undefined,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create task");
      }

      const { task } = await response.json();
      toast.success("Task created");
      setIsCreateDialogOpen(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setNewTaskAssigneeId(null);
      setNewTaskStartDate("");
      setNewTaskEndDate("");
      void mutate();

      // Navigate to the new task
      router.push(`/files/tasks/${task.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create task"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProjectId) return;

    const deletePromise = fetch(
      `/api/projects/${selectedProjectId}/tasks/${taskId}`,
      { method: "DELETE" }
    ).then(async (response) => {
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to delete task");
      }
    });

    toast.promise(deletePromise, {
      loading: "Deleting task...",
      success: () => {
        void mutate();
        return "Task deleted";
      },
      error: (error) =>
        error instanceof Error ? error.message : "Failed to delete task",
    });
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (!selectedProjectId) return;

    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/tasks/${taskId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to update task");
      }

      toast.success(`Status updated to ${STATUS_CONFIG[newStatus].label}`);
      void mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update task"
      );
    }
  };

  const tasks = data?.tasks ?? [];

  // Apply filters
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter)
      return false;
    return true;
  });

  // Group tasks by status
  const tasksByStatus: Record<TaskStatus, TaskWithAssignee[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    completed: [],
    cancelled: [],
  };

  for (const task of filteredTasks) {
    tasksByStatus[task.status as TaskStatus].push(task);
  }

  const hasFilters = statusFilter !== "all" || priorityFilter !== "all";

  // Show full-screen project creation view if user has no (non-default) projects
  if (needsFirstProject) {
    return <FirstProjectPrompt />;
  }

  // Show loading state while waiting for project selection
  if (isProjectLoading || !selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-background">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background">
      <div className="flex items-center justify-between border-border border-b p-4">
        <div className="flex items-center gap-3">
          <h2 className="font-medium text-sm">Project Tasks</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
            Linear integration coming soon
          </span>
        </div>
        {tasks.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant={hasFilters ? "secondary" : "outline"}
                >
                  <Filter className="mr-1 h-4 w-4" />
                  Filter
                  {hasFilters && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs">
                      {(statusFilter !== "all" ? 1 : 0) +
                        (priorityFilter !== "all" ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="p-2">
                  <label className="font-medium text-muted-foreground text-xs">
                    Status
                  </label>
                  <Select
                    onValueChange={(v) =>
                      setStatusFilter(v as TaskStatus | "all")
                    }
                    value={statusFilter}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-2">
                  <label className="font-medium text-muted-foreground text-xs">
                    Priority
                  </label>
                  <Select
                    onValueChange={(v) =>
                      setPriorityFilter(v as TaskPriority | "all")
                    }
                    value={priorityFilter}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasFilters && (
                  <div className="border-border border-t p-2">
                    <Button
                      className="w-full"
                      onClick={() => {
                        setStatusFilter("all");
                        setPriorityFilter("all");
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Clear Filters
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              disabled={!selectedProjectId}
              onClick={() => setIsGenerateDialogOpen(true)}
              size="sm"
              variant="outline"
            >
              <Sparkles className="mr-1 h-4 w-4" />
              Generate
            </Button>

            <Button
              disabled={!selectedProjectId}
              onClick={() => setIsCreateDialogOpen(true)}
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              New Task
            </Button>
          </div>
        )}
      </div>

      {isLoading || isProjectLoading || !selectedProjectId ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-muted-foreground">No tasks found.</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Create your first task or generate tasks from documents.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Create Task
            </Button>
            <Button
              onClick={() => setIsGenerateDialogOpen(true)}
              size="sm"
              variant="outline"
            >
              <Sparkles className="mr-1 h-4 w-4" />
              Generate from Files
            </Button>
          </div>
        </div>
      ) : (
        <ScrollArea className="h-[60vh]">
          <div className="space-y-6 p-4">
            {Object.entries(tasksByStatus).map(([status, statusTasks]) => {
              if (statusTasks.length === 0 && statusFilter !== "all")
                return null;
              if (statusTasks.length === 0 && statusFilter === "all")
                return null;

              const config = STATUS_CONFIG[status as TaskStatus];
              const StatusIcon = config.icon;

              return (
                <div key={status}>
                  <div className="mb-2 flex items-center gap-2">
                    <StatusIcon className={cn("h-4 w-4", config.className)} />
                    <h3 className="font-medium text-sm">{config.label}</h3>
                    <span className="text-muted-foreground text-xs">
                      ({statusTasks.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {statusTasks.map((task) => {
                      const priorityConfig =
                        PRIORITY_CONFIG[task.priority as TaskPriority];

                      return (
                        <div
                          className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm transition-colors hover:bg-accent/50"
                          key={task.id}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            {/* Status dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="mt-0.5 shrink-0"
                                  type="button"
                                >
                                  <StatusIcon
                                    className={cn(
                                      "h-5 w-5 cursor-pointer transition-colors hover:opacity-70",
                                      config.className
                                    )}
                                  />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {Object.entries(STATUS_CONFIG).map(
                                  ([key, statusConfig]) => {
                                    const Icon = statusConfig.icon;
                                    return (
                                      <DropdownMenuItem
                                        key={key}
                                        onClick={() =>
                                          handleStatusChange(
                                            task.id,
                                            key as TaskStatus
                                          )
                                        }
                                      >
                                        <Icon
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            statusConfig.className
                                          )}
                                        />
                                        {statusConfig.label}
                                      </DropdownMenuItem>
                                    );
                                  }
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <Link
                                className="truncate font-medium text-sm hover:underline"
                                href={`/files/tasks/${task.id}`}
                              >
                                {task.title}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5",
                                    priorityConfig.className
                                  )}
                                >
                                  {priorityConfig.label}
                                </span>
                                {task.endDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(task.endDate), "MMM d")}
                                  </span>
                                )}
                                {task.assigneeEmail && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {task.assigneeEmail}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() =>
                                    router.push(`/files/tasks/${task.id}`)
                                  }
                                  size="icon"
                                  variant="ghost"
                                >
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open task</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleDeleteTask(task.id)}
                                  size="icon"
                                  variant="ghost"
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete task</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Create Task Dialog */}
      <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label
                className="mb-1.5 block font-medium text-sm"
                htmlFor="task-title"
              >
                Title
              </label>
              <Input
                id="task-title"
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskTitle.trim()) {
                    handleCreateTask();
                  }
                }}
                placeholder="Task title..."
                value={newTaskTitle}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block font-medium text-sm"
                htmlFor="task-description"
              >
                Description (optional)
              </label>
              <Textarea
                id="task-description"
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Task description..."
                rows={3}
                value={newTaskDescription}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="mb-1.5 block font-medium text-sm"
                  htmlFor="task-priority"
                >
                  Priority
                </label>
                <Select
                  onValueChange={(v) => setNewTaskPriority(v as TaskPriority)}
                  value={newTaskPriority}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  className="mb-1.5 flex items-center gap-1.5 font-medium text-sm"
                  htmlFor="task-assignee"
                >
                  <User className="h-4 w-4" />
                  Assignee
                </label>
                <Select
                  onValueChange={(v) =>
                    setNewTaskAssigneeId(v === "unassigned" ? null : v)
                  }
                  value={newTaskAssigneeId ?? "unassigned"}
                >
                  <SelectTrigger id="task-assignee">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="mb-1.5 flex items-center gap-1.5 font-medium text-sm"
                  htmlFor="task-start-date"
                >
                  <Calendar className="h-4 w-4" />
                  Start Date
                </label>
                <Input
                  id="task-start-date"
                  onChange={(e) => setNewTaskStartDate(e.target.value)}
                  type="date"
                  value={newTaskStartDate}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 flex items-center gap-1.5 font-medium text-sm"
                  htmlFor="task-end-date"
                >
                  <Calendar className="h-4 w-4" />
                  Due Date
                </label>
                <Input
                  id="task-end-date"
                  onChange={(e) => setNewTaskEndDate(e.target.value)}
                  type="date"
                  value={newTaskEndDate}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsCreateDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!newTaskTitle.trim() || isCreating}
              onClick={handleCreateTask}
            >
              {isCreating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Tasks Dialog */}
      <GenerateTasksDialog
        onOpenChange={setIsGenerateDialogOpen}
        onTasksCreated={() => void mutate()}
        open={isGenerateDialogOpen}
      />
    </div>
  );
}
