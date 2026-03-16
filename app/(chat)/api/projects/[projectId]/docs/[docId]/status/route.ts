import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getProjectByIdForUser, getProjectDocById } from "@/lib/db/queries";

/**
 * Lightweight endpoint to check document processing status.
 * Used by upload notifications to poll for completion.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, docId } = await params;

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await getProjectDocById({ docId });
  if (!doc || doc.projectId !== project.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      parseStatus: doc.parseStatus,
      indexedAt: doc.indexedAt,
    },
    { status: 200 }
  );
}
