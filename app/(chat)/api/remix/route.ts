import { streamText } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import {
  getTemplatePrompt,
  type RemixTemplateId,
} from "@/lib/constants/remix-templates";
import {
  getProjectByIdForUser,
  getProjectDocsByProjectId,
} from "@/lib/db/queries";
import type { NoteLabel } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 60;

const requestSchema = z.object({
  projectId: z.string().uuid(),
  targetDocIds: z.array(z.string()),
  template: z.enum([
    "product_build_plan",
    "next_steps",
    "twitter_thread",
    "instagram_caption",
    "linkedin_post",
    "newsletter_excerpt",
    "slides",
    "custom",
  ] as const),
  customInstructions: z.string().max(10_000).optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let requestBody: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    requestBody = requestSchema.parse(json);
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const { projectId, targetDocIds, template, customInstructions } = requestBody;

  try {
    // Verify project access
    const project = await getProjectByIdForUser({
      projectId,
      userId: session.user.id,
    });

    if (!project) {
      return new ChatSDKError("not_found:database").toResponse();
    }

    // Get the content from target documents
    const allDocs = await getProjectDocsByProjectId({ projectId });
    const targetDocs = allDocs.filter((doc) => targetDocIds.includes(doc.id));

    if (targetDocs.length === 0) {
      return new ChatSDKError(
        "bad_request:api",
        "No valid documents found"
      ).toResponse();
    }

    // Fetch document content
    const docContents: string[] = [];
    for (const doc of targetDocs) {
      try {
        const response = await fetch(doc.blobUrl);
        if (response.ok) {
          const text = await response.text();
          // Extract labels from metadata if present
          const labels =
            (doc.metadata as { labels?: NoteLabel[] })?.labels ?? [];
          const labelSuffix =
            labels.length > 0
              ? ` [labels: ${labels.map((l) => l.name).join(", ")}]`
              : "";
          docContents.push(
            `--- ${doc.description || doc.filename}${labelSuffix} ---\n${text}`
          );
        }
      } catch {
        // Skip failed fetches
      }
    }

    if (docContents.length === 0) {
      return new ChatSDKError(
        "bad_request:api",
        "Could not read document content"
      ).toResponse();
    }

    const combinedContent = docContents.join("\n\n");

    // Get the template prompt
    const templatePrompt = getTemplatePrompt(
      template as RemixTemplateId,
      customInstructions
    );

    const model = myProvider.languageModel("deepseek-v3");

    const systemPrompt = `You are a professional content creator and social media strategist. Your job is to transform source content into engaging, platform-optimized formats.

${templatePrompt}

Important:
- Focus on the key insights, stories, and value from the source content
- Adapt the tone and style for the target platform
- Make it shareable and engaging
- Preserve the core message while making it accessible
- Output ONLY the transformed content, no meta-commentary or explanations`;

    const userPrompt = `Transform the following content:

${combinedContent}

${template === "custom" && customInstructions ? `\nCustom instructions: ${customInstructions}` : ""}`;

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });

    // Return SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            const data = JSON.stringify({ type: "text-delta", delta: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.close();
        } catch (error) {
          console.error("[remix] Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Remix generation error:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to generate remixed content"
    ).toResponse();
  }
}
