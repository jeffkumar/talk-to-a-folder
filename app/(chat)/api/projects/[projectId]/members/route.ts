import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getProjectByIdForUser,
  getProjectMembers,
  getProjectRole,
  inviteUserToProject,
} from "@/lib/db/queries";
import { sendProjectInviteEmail } from "@/lib/email";

const InviteBodySchema = z.object({
  email: z.string().trim().min(3).max(320),
  role: z.enum(["admin", "member"]),
});

export async function GET(
  _request: Request,
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

  const members = await getProjectMembers({ projectId });
  return NextResponse.json({ members, currentUserRole: role }, { status: 200 });
}

export async function POST(
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
  if (role === "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = InviteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await inviteUserToProject({
      projectId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: session.user.id,
    });

    const proj = await getProjectByIdForUser({
      projectId,
      userId: session.user.id,
    });
    const inviterName =
      session.user.displayName || session.user.email || "A teammate";
    const host = request.headers.get("host") ?? "app.adventureflow.ai";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const appUrl = `${protocol}://${host}`;

    sendProjectInviteEmail(
      parsed.data.email,
      inviterName,
      proj?.name ?? "a project",
      appUrl
    ).catch(console.error);

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to invite member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
