import { del, put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  deleteProjectDocById,
  getProjectByIdForUser,
  getProjectDocById,
  getProjectRole,
  markProjectDocDeleting,
  updateProjectDoc,
} from "@/lib/db/queries";
import { namespacesForSourceTypes } from "@/lib/rag/source-routing";
import { deleteByFilterFromTurbopuffer } from "@/lib/rag/turbopuffer";

// Built-in agents that are always available (finance is now opt-in via prebuilt)
const BUILT_IN_AGENT_IDS = ["files", "project", "email"];

// Helper to get user's first name from session
function getUserFirstName(session: {
  user: { displayName?: string | null; email?: string | null };
}): string {
  if (session.user.displayName) {
    // Extract first name from full name (e.g., "Jeff Smith" -> "Jeff")
    const firstName =
      session.user.displayName.split(/\s+/).at(0) ?? session.user.displayName;
    return firstName.trim();
  }
  // Extract name from email as fallback
  const email = session.user.email;
  if (typeof email === "string") {
    const localPart = email.split("@").at(0) ?? "";
    const namePart = localPart.split(/[._-]/).at(0) ?? localPart;
    return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
  }
  return "Your";
}

function getEmailAgentSystemPrompt(userFirstName: string): string {
  return `You are ${userFirstName}'s Rockstar Email Agent. Help ${userFirstName} write very clear and concise emails.

You should help with drafting up proposals or making negotiations.

Keep it short and to the point.

Never make it sound like a sales person. Be technical, but not overly technical. Help ${userFirstName} get across the line with negotiations.

Never end an email with Best. Cheers is much better.

When signing off emails, use "${userFirstName}" as the sender name.

Be creative!`;
}

function isVercelBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; agentId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, agentId } = await params;

  // Check for built-in agents
  if (BUILT_IN_AGENT_IDS.includes(agentId)) {
    const userFirstName = getUserFirstName(session);
    let name = "Project";
    let description = "Documents, notes, slides, and more";
    let systemPrompt = "";

    if (agentId === "email") {
      name = "Rockstar Emails";
      description = "Draft clear, concise emails";
      systemPrompt = getEmailAgentSystemPrompt(userFirstName);
    }

    return NextResponse.json(
      {
        agent: {
          id: agentId,
          name,
          description,
          systemPrompt,
          isBuiltIn: true,
        },
      },
      { status: 200 }
    );
  }

  // Check for finance agent (prebuilt, opt-in)
  if (agentId === "finance") {
    return NextResponse.json(
      {
        agent: {
          id: "finance",
          name: "Finance",
          description: "Financial analysis and transaction queries",
          systemPrompt: "",
          isBuiltIn: true,
          isPrebuilt: true,
        },
      },
      { status: 200 }
    );
  }

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await getProjectDocById({ docId: agentId });
  if (!doc || doc.projectId !== project.id || doc.documentType !== "agent") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch the system prompt from blob storage
  let systemPrompt = "";
  try {
    const response = await fetch(doc.blobUrl);
    if (response.ok) {
      systemPrompt = await response.text();
    }
  } catch {
    // Content fetch failed, return empty
  }

  return NextResponse.json(
    {
      agent: {
        id: doc.id,
        name: doc.description || doc.filename.replace(/\.md$/, ""),
        description: doc.category || "",
        systemPrompt,
        isBuiltIn: false,
        docId: doc.id,
      },
    },
    { status: 200 }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; agentId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, agentId } = await params;

  // Cannot edit built-in agents
  if (BUILT_IN_AGENT_IDS.includes(agentId)) {
    return NextResponse.json(
      { error: "Cannot edit built-in agents" },
      { status: 403 }
    );
  }

  const role = await getProjectRole({ projectId, userId: session.user.id });
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await getProjectDocById({ docId: agentId });
  if (!doc || doc.projectId !== project.id || doc.documentType !== "agent") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only creator or admin can edit
  if (role === "member" && doc.createdBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, systemPrompt } = body as {
    name?: string;
    description?: string;
    systemPrompt?: string;
  };

  const newName = name?.trim() || doc.description || "Untitled Agent";
  const newDescription = description?.trim() ?? doc.category ?? "";
  const newSystemPrompt = systemPrompt ?? "";
  const filename = `${newName}.md`;

  // Delete old blob if it's a Vercel blob
  if (isVercelBlobUrl(doc.blobUrl)) {
    await del(doc.blobUrl);
  }

  // Upload new content
  const blob = await put(
    `agents/${projectId}/${Date.now()}-${filename}`,
    newSystemPrompt,
    {
      access: "public",
      contentType: "text/markdown",
    }
  );

  await updateProjectDoc({
    docId: agentId,
    data: {
      blobUrl: blob.url,
      filename,
      description: newName,
      category: newDescription,
      sizeBytes: new Blob([newSystemPrompt]).size,
    },
  });

  return NextResponse.json(
    {
      agent: {
        id: agentId,
        name: newName,
        description: newDescription,
        systemPrompt: newSystemPrompt,
        isBuiltIn: false,
        docId: agentId,
      },
    },
    { status: 200 }
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; agentId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, agentId } = await params;

  // Cannot delete built-in agents
  if (BUILT_IN_AGENT_IDS.includes(agentId)) {
    return NextResponse.json(
      { error: "Cannot delete built-in agents" },
      { status: 403 }
    );
  }

  const role = await getProjectRole({ projectId, userId: session.user.id });
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = await getProjectByIdForUser({
    projectId,
    userId: session.user.id,
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await getProjectDocById({ docId: agentId });
  if (!doc || doc.projectId !== project.id || doc.documentType !== "agent") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role === "member" && doc.createdBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await markProjectDocDeleting({ docId: doc.id });

  const [docsNamespace] = namespacesForSourceTypes(
    ["docs"],
    project.id,
    project.isDefault
  );

  if (docsNamespace) {
    await deleteByFilterFromTurbopuffer({
      namespace: docsNamespace,
      filters: ["doc_id", "Eq", doc.id],
    });
  }

  if (isVercelBlobUrl(doc.blobUrl)) {
    await del(doc.blobUrl);
  }

  await deleteProjectDocById({ docId: doc.id, userId: session.user.id });

  return NextResponse.json({ deleted: true }, { status: 200 });
}
