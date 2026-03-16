import { generateText } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import {
  getProjectByIdForUser,
  getProjectDocsByProjectId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 60;

const slidesSchema = z.object({
  slides: z.array(
    z.object({
      title: z.string(),
      bullets: z.array(z.string()),
      notes: z.string().optional(),
      imageUrl: z.string().optional(),
      imageCaption: z.string().optional(),
    })
  ),
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

const requestSchema = z.object({
  projectId: z.string().uuid(),
  targetDocIds: z.array(z.string()),
  title: z.string().min(1).max(200),
  instructions: z.string().max(2000).optional(),
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

  const { projectId, targetDocIds, title, instructions } = requestBody;

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
          docContents.push(
            `--- ${doc.description || doc.filename} ---\n${text}`
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

    const model = myProvider.languageModel("chat-model");

    const result = await generateText({
      model,
      system: `You are a professional presentation designer specializing in pitch decks and business presentations.
Create a slide deck based on the given content. Output ONLY valid JSON with no other text.

The JSON must have this exact structure:
{
  "slides": [
    {
      "title": "Slide title here",
      "bullets": ["Key point 1", "Key point 2", "Key point 3"],
      "notes": "Optional speaker notes"
    }
  ]
}

Guidelines:
1. Create 5-8 slides depending on topic complexity
2. Keep titles concise and impactful (max 6 words)
3. Use 3-5 bullet points per slide, each under 15 words
4. Use clear, professional language
5. Speaker notes should provide additional context for presenting
6. First slide should be a title slide
7. Last slide should be a closing/call-to-action slide`,
      prompt: `Create a professional slide deck presentation titled "${title}" based on the following content:

${combinedContent}
${instructions ? `\nAdditional instructions: ${instructions}` : ""}

Respond with ONLY the JSON object containing the slides array.`,
    });

    // Parse the JSON from the response
    const jsonText = extractJSON(result.text);
    let parsedResponse: unknown;

    try {
      parsedResponse = JSON.parse(jsonText);
    } catch {
      console.error("[slides-generate] Failed to parse JSON:", result.text);
      return new ChatSDKError(
        "bad_request:api",
        "Failed to parse generated slides"
      ).toResponse();
    }

    // Validate with schema
    const validated = slidesSchema.safeParse(parsedResponse);
    if (!validated.success) {
      console.error(
        "[slides-generate] Schema validation failed:",
        validated.error
      );
      return new ChatSDKError(
        "bad_request:api",
        "Invalid slides format generated"
      ).toResponse();
    }

    return Response.json({
      success: true,
      slides: validated.data,
    });
  } catch (error) {
    console.error("Slides generation error:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to generate slides"
    ).toResponse();
  }
}
