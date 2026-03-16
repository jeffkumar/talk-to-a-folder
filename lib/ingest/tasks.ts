import crypto from "node:crypto";
import type { Task } from "@/lib/db/schema";
import {
  createEmbedding,
  deleteByFilterFromTurbopuffer,
  type TurbopufferUpsertRow,
  upsertRowsToTurbopuffer,
} from "@/lib/rag/turbopuffer";

const MAX_CONTENT_CHARS = 3800;

/**
 * Get the turbopuffer namespace for tasks in a project.
 */
export function getTasksNamespace(
  projectId: string,
  isDefaultProject: boolean
): string {
  return isDefaultProject
    ? "_synergy_tasksv1"
    : `_synergy_${projectId}_tasksv1`;
}

/**
 * Ingest a task into turbopuffer for semantic search.
 */
export async function ingestTaskToTurbopuffer({
  task,
  projectId,
  isDefaultProject,
  assigneeEmail,
}: {
  task: Task;
  projectId: string;
  isDefaultProject: boolean;
  assigneeEmail?: string | null;
}): Promise<{ namespace: string; rowId: string }> {
  const namespace = getTasksNamespace(projectId, isDefaultProject);
  const indexedAtMs = Date.now();

  // Build searchable content from task
  const contentParts: string[] = [`Task: ${task.title}`];

  if (task.description) {
    contentParts.push(`Description: ${task.description}`);
  }

  contentParts.push(`Status: ${task.status}`);
  contentParts.push(`Priority: ${task.priority}`);

  if (task.startDate) {
    contentParts.push(`Start Date: ${task.startDate}`);
  }

  if (task.endDate) {
    contentParts.push(`Due Date: ${task.endDate}`);
  }

  if (assigneeEmail) {
    contentParts.push(`Assigned to: ${assigneeEmail}`);
  }

  const content = contentParts.join("\n");
  const truncatedContent =
    content.length > MAX_CONTENT_CHARS
      ? `${content.slice(0, MAX_CONTENT_CHARS)}…`
      : content;

  const vector = await createEmbedding(content);

  const idHash = crypto
    .createHash("sha256")
    .update(`task:${task.id}`)
    .digest("hex")
    .slice(0, 40);
  const rowId = `task_${idHash}`;

  const row: TurbopufferUpsertRow = {
    id: rowId,
    vector,
    content: truncatedContent,
    sourceType: "task",
    task_id: task.id,
    project_id: projectId,
    created_by: task.createdBy,
    assignee_id: task.assigneeId ?? null,
    assignee_email: assigneeEmail ?? null,
    title: task.title,
    status: task.status,
    priority: task.priority,
    start_date: task.startDate ?? null,
    end_date: task.endDate ?? null,
    source_doc_id: task.sourceDocId ?? null,
    indexedAtMs,
    createdAtMs: task.createdAt.getTime(),
    completedAtMs: task.completedAt?.getTime() ?? null,
  };

  await upsertRowsToTurbopuffer({ namespace, rows: [row] });

  return { namespace, rowId };
}

/**
 * Delete a task from turbopuffer.
 */
export async function deleteTaskFromTurbopuffer({
  taskId,
  projectId,
  isDefaultProject,
}: {
  taskId: string;
  projectId: string;
  isDefaultProject: boolean;
}): Promise<void> {
  const namespace = getTasksNamespace(projectId, isDefaultProject);

  await deleteByFilterFromTurbopuffer({
    namespace,
    filters: ["task_id", "Eq", taskId],
  });
}

/**
 * Re-index a task after updates.
 */
export async function reindexTaskInTurbopuffer({
  task,
  projectId,
  isDefaultProject,
  assigneeEmail,
}: {
  task: Task;
  projectId: string;
  isDefaultProject: boolean;
  assigneeEmail?: string | null;
}): Promise<{ namespace: string; rowId: string }> {
  // Simply re-upsert - turbopuffer will update the existing row
  return ingestTaskToTurbopuffer({
    task,
    projectId,
    isDefaultProject,
    assigneeEmail,
  });
}
