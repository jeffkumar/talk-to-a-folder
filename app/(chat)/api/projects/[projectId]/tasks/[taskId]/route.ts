import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  deleteTask,
  getProjectRole,
  getTaskById,
  updateTask,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10_000).nullish(),
  assigneeId: z.string().uuid().nullish(),
  status: z
    .enum(["todo", "in_progress", "in_review", "completed", "cancelled"])
    .optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, taskId } = await params;
    const role = await getProjectRole({ projectId, userId: session.user.id });

    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const task = await getTaskById({ taskId });

    if (!task || task.projectId !== projectId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json({ error: "Failed to get task" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, taskId } = await params;
    const role = await getProjectRole({ projectId, userId: session.user.id });

    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existingTask = await getTaskById({ taskId });

    if (!existingTask || existingTask.projectId !== projectId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updatedTask = await updateTask({
      taskId,
      data: parsed.data,
    });

    return NextResponse.json({ task: updatedTask }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, taskId } = await params;
    const role = await getProjectRole({ projectId, userId: session.user.id });

    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existingTask = await getTaskById({ taskId });

    if (!existingTask || existingTask.projectId !== projectId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Only creator, admin, or owner can delete
    if (role === "member" && existingTask.createdBy !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteTask({ taskId });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
