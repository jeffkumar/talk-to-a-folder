"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ProjectSwitcher } from "@/components/project-switcher";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  todo: { label: "To Do", icon: Circle, className: "task-status-todo" },
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

type MemberOption = {
  userId: string;
  email: string;
};

export function TaskEditor({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { selectedProjectId, isLoading: isProjectLoading } =
    useProjectSelector();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const {
    data: taskData,
    isLoading: isTaskLoading,
    error,
  } = useSWR<{ task: TaskWithAssignee }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/tasks/${taskId}`
      : null,
    fetcher
  );

  const { data: membersData } = useSWR<{
    members: Array<{ kind: string; userId?: string; email: string }>;
  }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/members` : null,
    fetcher
  );

  const members: MemberOption[] = (membersData?.members ?? [])
    .filter(
      (m): m is { kind: string; userId: string; email: string } =>
        m.kind === "user" && typeof m.userId === "string"
    )
    .map((m) => ({ userId: m.userId, email: m.email }));

  // Initialize form from task data
  useEffect(() => {
    if (taskData?.task) {
      const task = taskData.task;
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status as TaskStatus);
      setPriority(task.priority as TaskPriority);
      setAssigneeId(task.assigneeId ?? null);
      setStartDate(task.startDate ?? "");
      setEndDate(task.endDate ?? "");
      setHasChanges(false);
      setJustSaved(false);
    }
  }, [taskData]);

  const handleSave = useCallback(async () => {
    if (!selectedProjectId || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/tasks/${taskId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            status,
            priority,
            assigneeId: assigneeId || null,
            startDate: startDate || null,
            endDate: endDate || null,
          }),
        }
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to save task");
      }

      setHasChanges(false);
      setJustSaved(true);
      toast.success("Task saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedProjectId,
    taskId,
    title,
    description,
    status,
    priority,
    assigneeId,
    startDate,
    endDate,
    isSaving,
  ]);

  const handleDelete = useCallback(async () => {
    if (!selectedProjectId || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/projects/${selectedProjectId}/tasks/${taskId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to delete task");
      }

      toast.success("Task deleted");
      router.push("/files/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
      setIsDeleting(false);
    }
  }, [selectedProjectId, taskId, router, isDeleting]);

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

  const markChanged = () => {
    setHasChanges(true);
    setJustSaved(false);
  };

  if (isTaskLoading || isProjectLoading || !selectedProjectId) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !taskData?.task) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Task not found</p>
        <Button asChild variant="outline">
          <Link href="/files/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-border border-b bg-background px-2 py-1.5 md:px-4">
        <SidebarToggle />
        <ProjectSwitcher />

        <Button asChild className="gap-1.5" size="sm" variant="ghost">
          <Link href="/files/tasks">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {hasChanges ? (
            <span className="text-muted-foreground text-xs">
              Unsaved changes
            </span>
          ) : justSaved ? (
            <span className="flex items-center gap-1 text-green-600 text-xs">
              <Check className="h-3 w-3" />
              Saved
            </span>
          ) : null}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="text-destructive" size="sm" variant="ghost">
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this task? This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            disabled={isSaving || !hasChanges}
            onClick={handleSave}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Title */}
          <div>
            <label
              className="mb-1.5 block font-medium text-sm"
              htmlFor="task-title"
            >
              Title
            </label>
            <Input
              className="font-medium text-lg"
              id="task-title"
              onChange={(e) => {
                setTitle(e.target.value);
                markChanged();
              }}
              placeholder="Task title..."
              value={title}
            />
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="mb-1.5 block font-medium text-sm"
                htmlFor="task-status"
              >
                Status
              </label>
              <Select
                onValueChange={(v) => {
                  setStatus(v as TaskStatus);
                  markChanged();
                }}
                value={status}
              >
                <SelectTrigger id="task-status">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        className={cn("h-4 w-4", statusConfig.className)}
                      />
                      {statusConfig.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", config.className)} />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                className="mb-1.5 block font-medium text-sm"
                htmlFor="task-priority"
              >
                Priority
              </label>
              <Select
                onValueChange={(v) => {
                  setPriority(v as TaskPriority);
                  markChanged();
                }}
                value={priority}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5",
                        PRIORITY_CONFIG[priority].className
                      )}
                    >
                      {PRIORITY_CONFIG[priority].label}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span
                        className={cn("rounded px-2 py-0.5", config.className)}
                      >
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label
              className="mb-1.5 flex items-center gap-1.5 font-medium text-sm"
              htmlFor="task-assignee"
            >
              <User className="h-4 w-4" />
              Assignee
            </label>
            <Select
              onValueChange={(v) => {
                setAssigneeId(v === "unassigned" ? null : v);
                markChanged();
              }}
              value={assigneeId ?? "unassigned"}
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

          {/* Dates */}
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
                onChange={(e) => {
                  setStartDate(e.target.value);
                  markChanged();
                }}
                type="date"
                value={startDate}
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
                onChange={(e) => {
                  setEndDate(e.target.value);
                  markChanged();
                }}
                type="date"
                value={endDate}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              className="mb-1.5 block font-medium text-sm"
              htmlFor="task-description"
            >
              Description
            </label>
            <Textarea
              className="resize-none"
              id="task-description"
              onChange={(e) => {
                setDescription(e.target.value);
                markChanged();
              }}
              placeholder="Add a description..."
              rows={6}
              value={description}
            />
          </div>

          {/* Metadata */}
          {taskData.task.createdAt && (
            <div className="border-border border-t pt-4 text-muted-foreground text-xs">
              <p>
                Created{" "}
                {format(new Date(taskData.task.createdAt), "PPP 'at' p")}
              </p>
              {taskData.task.completedAt && (
                <p>
                  Completed{" "}
                  {format(new Date(taskData.task.completedAt), "PPP 'at' p")}
                </p>
              )}
              {taskData.task.creatorEmail && (
                <p>Created by {taskData.task.creatorEmail}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
