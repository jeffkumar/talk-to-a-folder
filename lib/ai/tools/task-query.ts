import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  getTaskCountsByStatus,
  getTasksByProjectId,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/db/queries";

type TaskQueryProps = {
  session: Session;
  projectId?: string;
};

export const taskQuery = ({ session, projectId }: TaskQueryProps) =>
  tool({
    description:
      "Query tasks in the current project. Use this to find tasks by status, assignee, priority, or due date. Returns task details including title, description, status, priority, and dates.",
    inputSchema: z.object({
      query_type: z
        .enum(["list", "count_by_status"])
        .describe(
          "list: returns task details; count_by_status: returns counts grouped by status"
        ),
      filters: z
        .object({
          status: z
            .enum([
              "todo",
              "in_progress",
              "in_review",
              "completed",
              "cancelled",
            ])
            .optional()
            .describe("Filter by task status"),
          priority: z
            .enum(["urgent", "high", "medium", "low"])
            .optional()
            .describe("Filter by task priority"),
          assignee_id: z
            .string()
            .uuid()
            .optional()
            .describe("Filter by assignee user ID"),
          my_tasks_only: z
            .boolean()
            .optional()
            .describe(
              "If true, only return tasks assigned to the current user"
            ),
        })
        .optional(),
    }),
    execute: async (input) => {
      if (!session.user?.id) {
        return { error: "Unauthorized" };
      }

      if (!projectId) {
        return { error: "No project selected" };
      }

      try {
        if (input.query_type === "count_by_status") {
          const counts = await getTaskCountsByStatus({ projectId });
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          return {
            query_type: "count_by_status",
            counts,
            total,
          };
        }

        // query_type === "list"
        const filters = input.filters ?? {};
        const assigneeId = filters.my_tasks_only
          ? session.user.id
          : filters.assignee_id;

        const tasks = await getTasksByProjectId({
          projectId,
          status: filters.status as TaskStatus | undefined,
          priority: filters.priority as TaskPriority | undefined,
          assigneeId,
        });

        // Format tasks for display
        const formattedTasks = tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignee: task.assigneeEmail ?? "Unassigned",
          startDate: task.startDate,
          endDate: task.endDate,
          createdAt: task.createdAt.toISOString(),
          completedAt: task.completedAt?.toISOString() ?? null,
        }));

        return {
          query_type: "list",
          tasks: formattedTasks,
          count: formattedTasks.length,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error ? error.message : "Failed to query tasks",
        };
      }
    },
  });
