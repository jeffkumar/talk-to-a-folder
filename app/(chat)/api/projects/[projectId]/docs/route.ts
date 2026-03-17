import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  createProjectDoc,
  getProjectByIdForUser,
  getProjectDocsByProjectId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

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
    const project = await getProjectByIdForUser({
      projectId,
      userId: session.user.id,
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const docs = await getProjectDocsByProjectId({ projectId });

    // Check if we need to include all doc types (for looking up specific IDs)
    const includeAll =
      request.nextUrl.searchParams.get("includeAll") === "true";

    // Check if a specific document type is requested (e.g., type=note)
    const typeFilter = request.nextUrl.searchParams.get("type");

    let visibleDocs;
    if (typeFilter === "note") {
      visibleDocs = docs.filter((doc) => doc.documentType === "note");
    } else if (includeAll) {
      visibleDocs = docs;
    } else {
      visibleDocs = docs.filter(
        (doc) =>
          doc.documentType !== "agent" &&
          doc.documentType !== "note" &&
          doc.documentType !== "workflow_agent"
      );
    }

    // Return as "notes" key when type=note for backwards compatibility
    if (typeFilter === "note") {
      return NextResponse.json({ notes: visibleDocs }, { status: 200 });
    }

    return NextResponse.json({ docs: visibleDocs }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to load project docs"
    ).toResponse();
  }
}

const CreateNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  labels: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = CreateNoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { title, content, labels } = parsed.data;
  const filename = `${title.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 50)}.md`;

  const blob = await put(
    `notes/${projectId}/${Date.now()}-${filename}`,
    content,
    {
      access: "public",
      contentType: "text/markdown",
    }
  );

  const doc = await createProjectDoc({
    projectId,
    createdBy: session.user.id,
    blobUrl: blob.url,
    filename,
    mimeType: "text/markdown",
    sizeBytes: new Blob([content]).size,
    documentType: "note",
    description: title,
    metadata: labels ? { labels } : undefined,
  });

  return NextResponse.json({ note: doc }, { status: 201 });
}
