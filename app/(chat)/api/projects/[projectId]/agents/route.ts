import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  createProjectDoc,
  getProjectByIdForUser,
  getProjectDocsByProjectId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

// Helper to get user's first name from session
function getUserFirstName(session: {
  user: {
    displayName?: string | null;
    name?: string | null;
    email?: string | null;
  };
}): string {
  // Check displayName first, then name (from DefaultSession)
  const fullName = session.user.displayName || session.user.name;
  if (fullName) {
    // Extract first name from full name (e.g., "Jeff Smith" -> "Jeff")
    const firstName = fullName.split(/\s+/).at(0) ?? fullName;
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

// Built-in agents that are always available (function to personalize with user name)
function getBuiltInAgents(userFirstName: string) {
  return [
    {
      id: "files",
      name: "Files",
      description: "Files and notes only",
      systemPrompt: "", // Uses dedicated files-focused system prompt
      isBuiltIn: true,
    },
    {
      id: "project",
      name: "Project",
      description: "Documents, notes, slides, and more",
      systemPrompt: "", // Uses default system prompt
      isBuiltIn: true,
    },
    {
      id: "email",
      name: "Rockstar Emails",
      description: "Draft clear, concise emails",
      systemPrompt: `You are ${userFirstName}'s Rockstar Email Agent. Help ${userFirstName} write very clear and concise emails.\n\nYou should help with drafting up proposals or making negotiations.\n\nKeep it short and to the point.\n\nNever make it sound like a sales person. Be technical, but not overly technical. Help ${userFirstName} get across the line with negotiations.\n\nNever end an email with Best. Cheers is much better.\n\nWhen signing off emails, use "${userFirstName}" as the sender name.\n\nBe creative!`,
      isBuiltIn: true,
    },
    {
      id: "tasks",
      name: "Task Extractor",
      description: "Extract actionable tasks from documents and transcripts",
      systemPrompt: `You are a task extraction specialist. Your job is to analyze documents (meeting transcripts, notes, emails, project briefs) and extract clear, actionable tasks.

Rules:
1. Extract only genuine action items that someone needs to complete
2. Make task titles clear and actionable (start with a verb when possible)
3. Include relevant details in the description
4. Set appropriate priority based on urgency/importance mentioned in the content
5. If dates or deadlines are mentioned, include them
6. Don't create tasks for completed items or general information
7. Each task should be specific and self-contained
8. Prioritize quality over quantity - only extract real action items
9. When someone's name is mentioned with an action, note them as the assignee
10. Include the original context/quote where the task was identified`,
      isBuiltIn: true,
      reductoSchemaId: "tasks_v1",
    },
  ];
}

// Optional prebuilt agents that users can add to their project
const PREBUILT_AGENTS = [
  {
    id: "finance",
    name: "Finance",
    description: "Financial analysis and transaction queries",
    requirements:
      "Requires bank statements (CSV), credit card statements (CSV), or invoices (PDF/DOC)",
    systemPrompt: "", // Uses default finance system prompt
  },
  {
    id: "social-media",
    name: "Social Media Coordinator",
    description: "Repurpose content across platforms and analyze engagement",
    requirements:
      "Upload podcast transcripts, blog posts, tweets, or any content to remix",
    systemPrompt: `You are an expert Social Media Coordinator and Content Strategist. Your job is to help repurpose and remix content across different platforms while maximizing engagement.

## Your Core Capabilities

1. **Content Remixing**: Transform long-form content (podcasts, blogs, videos) into platform-specific formats:
   - Twitter/X threads with hooks and engagement
   - Instagram captions with CTAs and hashtags
   - LinkedIn posts with professional storytelling
   - Newsletter excerpts and email content
   - TikTok/Reels scripts
   - YouTube descriptions and timestamps

2. **Content Analysis**: Analyze what's working by looking at:
   - Which topics resonate most
   - What formats drive engagement
   - Best posting times and frequency
   - Audience insights from content performance

3. **Content Calendar**: Help plan and schedule content by:
   - Identifying evergreen vs timely content
   - Suggesting content themes and series
   - Balancing content types across platforms

## Your Style Guidelines

- Write hooks that stop the scroll
- Use pattern interrupts and curiosity gaps
- Include clear calls-to-action
- Match platform voice (professional on LinkedIn, casual on Twitter, visual on Instagram)
- Add relevant emojis sparingly for personality
- Create shareable, quotable moments
- Always think "would I share this?"

## When Remixing Content

1. Extract the core insight or story
2. Find the most engaging angle for the target platform
3. Front-load value - hook in the first line
4. Break down complex ideas into digestible chunks
5. End with engagement drivers (questions, CTAs, controversy)

## Content Best Practices

- **Twitter/X**: Bold opening, numbered threads, strategic line breaks, 2-3 hashtags max
- **Instagram**: Hook question, story format, emoji accents, 10-15 hashtags at end
- **LinkedIn**: Personal insight opening, short paragraphs, thought-provoking question to close
- **Newsletter**: Subject line first, personal tone, one key takeaway, soft CTA

When the user shares content, proactively suggest multiple formats and ask which platforms they want to prioritize. Always think about how to maximize the reach and impact of every piece of content.`,
  },
];

export async function GET(
  _request: NextRequest,
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

    const allDocs = await getProjectDocsByProjectId({ projectId });
    const customAgents = allDocs
      .filter(
        (doc) =>
          doc.documentType === "agent" && !(doc.metadata as any)?.prebuiltId
      )
      .map((doc) => ({
        id: doc.id,
        name: doc.description || doc.filename.replace(/\.md$/, ""),
        description: doc.category || "",
        isBuiltIn: false,
        docId: doc.id,
        agentType: (doc.metadata as Record<string, unknown>)?.agentType as
          | string
          | undefined,
      }));

    // Get personalized built-in agents
    const userFirstName = getUserFirstName(session);
    const builtInAgents = getBuiltInAgents(userFirstName);

    // Check if Finance agent has been enabled for this project
    // Finance is stored as a custom agent with prebuiltId = "finance"
    const enabledPrebuiltAgents = allDocs
      .filter(
        (doc) =>
          doc.documentType === "agent" && (doc.metadata as any)?.prebuiltId
      )
      .map((doc) => {
        const prebuiltId = (doc.metadata as any).prebuiltId as string;
        const prebuilt = PREBUILT_AGENTS.find((p) => p.id === prebuiltId);
        if (!prebuilt) return null;
        return {
          id: prebuiltId,
          name: prebuilt.name,
          description: prebuilt.description,
          isBuiltIn: true, // Treat as built-in for UI purposes
          isPrebuilt: true,
          docId: doc.id,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // Combine built-in agents, enabled prebuilt agents, and custom agents
    const agents = [
      ...builtInAgents,
      ...enabledPrebuiltAgents,
      ...customAgents,
    ];

    return NextResponse.json({ agents }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to load agents"
    ).toResponse();
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
    const project = await getProjectByIdForUser({
      projectId,
      userId: session.user.id,
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, systemPrompt, prebuiltId, metadata: extraMetadata } = body as {
      name?: string;
      description?: string;
      systemPrompt?: string;
      prebuiltId?: string;
      metadata?: Record<string, unknown>;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // If this is a prebuilt agent, validate it exists and use its system prompt
    let agentContent = systemPrompt || "";
    if (prebuiltId) {
      const prebuilt = PREBUILT_AGENTS.find((p) => p.id === prebuiltId);
      if (!prebuilt) {
        return NextResponse.json(
          { error: "Invalid prebuilt agent" },
          { status: 400 }
        );
      }
      // Use the prebuilt agent's system prompt if no custom one was provided
      if (!agentContent) {
        agentContent = prebuilt.systemPrompt;
      }
    }

    // Vercel Blob requires non-empty content
    if (!agentContent) {
      agentContent = " ";
    }

    const filename = `${name.trim()}.md`;

    // Store system prompt in blob storage
    const blob = await put(
      `agents/${projectId}/${Date.now()}-${filename}`,
      agentContent,
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
      sizeBytes: new Blob([agentContent]).size,
      documentType: "agent",
      description: name.trim(),
      category: description?.trim() || null,
      metadata: {
        ...(prebuiltId ? { prebuiltId } : {}),
        ...(extraMetadata ?? {}),
      },
    });

    return NextResponse.json(
      {
        agent: {
          id: prebuiltId || doc.id,
          name: name.trim(),
          description: description?.trim() || "",
          isBuiltIn: Boolean(prebuiltId),
          isPrebuilt: Boolean(prebuiltId),
          docId: doc.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to create agent"
    ).toResponse();
  }
}
