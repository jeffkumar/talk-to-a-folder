import { generateText } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { getProjectDocById, getProjectRole } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

// Schema accepts either sourceDocIds OR pastedContent (at least one required)
const GenerateTasksSchema = z
  .object({
    sourceDocIds: z.array(z.string().uuid()).max(10).optional(),
    pastedContent: z.string().max(100_000).optional(),
  })
  .refine(
    (data) =>
      (data.sourceDocIds && data.sourceDocIds.length > 0) ||
      (data.pastedContent && data.pastedContent.trim().length > 0),
    { message: "Either sourceDocIds or pastedContent is required" }
  );

const GeneratedTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const GeneratedTasksResponseSchema = z.object({
  tasks: z.array(GeneratedTaskSchema),
});

/**
 * Extract JSON from a response that may contain markdown code blocks or other text
 */
function extractJSON(text: string): string {
  // Try to find JSON in code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text.trim();
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
    const parsed = GenerateTasksSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const contentParts: string[] = [];
    const sourceDocIds: string[] = [];

    // Fetch content from source documents if provided
    if (parsed.data.sourceDocIds && parsed.data.sourceDocIds.length > 0) {
      for (const docId of parsed.data.sourceDocIds) {
        const doc = await getProjectDocById({ docId });
        if (!doc || doc.projectId !== projectId) {
          return NextResponse.json(
            { error: `Document ${docId} not found` },
            { status: 404 }
          );
        }

        // Fetch the document content from blob storage
        try {
          const response = await fetch(doc.blobUrl);
          if (response.ok) {
            const content = await response.text();
            if (content.trim()) {
              contentParts.push(
                `## Document: ${doc.description || doc.filename}\n\n${content}`
              );
              sourceDocIds.push(docId);
            }
          }
        } catch {
          // Skip documents that can't be fetched
        }
      }
    }

    // Add pasted content if provided
    if (parsed.data.pastedContent && parsed.data.pastedContent.trim()) {
      contentParts.push(
        `## Pasted Content\n\n${parsed.data.pastedContent.trim()}`
      );
    }

    if (contentParts.length === 0) {
      return NextResponse.json(
        { error: "No readable content found" },
        { status: 400 }
      );
    }

    const combinedContent = contentParts.join("\n\n---\n\n");

    const model = myProvider.languageModel("chat-model");

    const result = await generateText({
      model,
      system: `You are a task extraction specialist. Your job is to analyze documents (such as meeting transcripts, notes, emails, or other content) and extract clear, actionable tasks.

Rules:
1. Extract only genuine action items that someone needs to complete
2. Make task titles clear and actionable (start with a verb when possible)
3. IMPORTANT: Only include a description if there is ACTUAL context from the source content. Do NOT hallucinate or make up descriptions. If there isn't enough information to write a meaningful description, set description to "[Description needed]" or omit it entirely
4. Set appropriate priority based on urgency/importance mentioned in the content (urgent, high, medium, or low). Default to "medium" if not specified
5. If specific dates or deadlines are explicitly mentioned, include them in YYYY-MM-DD format. Do NOT guess or infer dates
6. Don't create tasks for completed items or general information
7. Each task should be specific and self-contained
8. Prioritize quality over quantity - only extract real action items
9. When someone's name is mentioned with an action, include their name in the description
10. If you include context from the source, use actual quotes - do not paraphrase or embellish

You MUST respond with ONLY a valid JSON object in this exact format (no other text):
{
  "tasks": [
    {
      "title": "Task title here",
      "description": "Only include if there is actual context. Use '[Description needed]' if unclear",
      "priority": "medium",
      "startDate": "2026-02-04",
      "endDate": "2026-02-10"
    }
  ]
}

Priority must be one of: "urgent", "high", "medium", "low"
Dates are optional and should be in YYYY-MM-DD format. Only include dates if explicitly mentioned.
Description is optional - leave it out or use "[Description needed]" if there's not enough context.`,
      prompt: `Extract actionable tasks from the following content and return them as JSON.

IMPORTANT: Do not make up or hallucinate descriptions. Only include descriptions with actual information from the content. If a task doesn't have clear context, either omit the description or use "[Description needed]".

Content to analyze:

${combinedContent}

Respond with ONLY the JSON object containing the tasks array.`,
    });

    // Parse the JSON from the response
    const jsonText = extractJSON(result.text);
    let parsedResponse: unknown;

    try {
      parsedResponse = JSON.parse(jsonText);
    } catch {
      console.error("[generate-tasks] Failed to parse JSON:", result.text);
      return NextResponse.json(
        { error: "Failed to parse generated tasks" },
        { status: 500 }
      );
    }

    // Validate with schema
    const validated = GeneratedTasksResponseSchema.safeParse(parsedResponse);
    if (!validated.success) {
      console.error(
        "[generate-tasks] Schema validation failed:",
        validated.error
      );
      return NextResponse.json(
        { error: "Invalid task format generated" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        generatedTasks: validated.data.tasks,
        sourceDocIds: sourceDocIds.length > 0 ? sourceDocIds : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[generate-tasks] Error:", error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 }
    );
  }
}
