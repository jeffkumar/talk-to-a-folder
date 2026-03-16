import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
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

    // Filter out agent, note, and workflow_agent documents - they have their own management interfaces
    // Unless includeAll is requested (used for looking up specific doc IDs in chat)
    const visibleDocs = includeAll
      ? docs
      : docs.filter(
          (doc) =>
            doc.documentType !== "agent" &&
            doc.documentType !== "note" &&
            doc.documentType !== "workflow_agent"
        );

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
