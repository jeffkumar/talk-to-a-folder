import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getProjectDocsByGoogleParentId,
  getProjectRole,
} from "@/lib/db/queries";

const QuerySchema = z.object({
  folderId: z.string().min(1),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const role = await getProjectRole({ projectId, userId: session.user.id });
  if (!role) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ folderId: searchParams.get("folderId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing folderId" }, { status: 400 });
  }

  const docs = await getProjectDocsByGoogleParentId({
    projectId,
    googleParentId: parsed.data.folderId,
  });

  return NextResponse.json({
    folderId: parsed.data.folderId,
    synced: docs.length > 0,
    count: docs.length,
    docs: docs.map((doc) => ({
      id: doc.id,
      name: doc.description || doc.filename,
      type: doc.documentType === "note" ? "note" : "file",
    })),
  });
}
