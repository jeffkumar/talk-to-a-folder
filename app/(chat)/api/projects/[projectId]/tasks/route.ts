import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createTask,
  getProjectRole,
  getTasksByProjectId,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(10_000).optional(),
  assigneeId: z.string().uuid().optional(),
  status: z
    .enum(["todo", "in_progress", "in_review", "completed", "cancelled"])
    .optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sourceDocId: z.string().uuid().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    const role = await getProjectRole({ projectId, userId: session.user.id });

    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as TaskStatus | null;
    const assigneeId = searchParams.get("assigneeId");
    const priority = searchParams.get("priority") as TaskPriority | null;

    const tasks = await getTasksByProjectId({
      projectId,
      status: status ?? undefined,
      assigneeId: assigneeId ?? undefined,
      priority: priority ?? undefined,
    });

    return NextResponse.json({ tasks }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json({ error: "Failed to get tasks" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    const role = await getProjectRole({ projectId, userId: session.user.id });

    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = CreateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const task = await createTask({
      projectId,
      createdBy: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      assigneeId: parsed.data.assigneeId,
      status: parsed.data.status,
      priority: parsed.data.priority,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      sourceDocId: parsed.data.sourceDocId,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
