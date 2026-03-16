import { generateText } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  emailFormattingPrompt,
  getEmailAgentSystemPrompt,
} from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import {
  getProjectByIdForUser,
  getProjectDocById,
  insertUsageLog,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { namespacesForSourceTypes } from "@/lib/rag/source-routing";
import {
  formatRetrievedContext,
  queryTurbopuffer,
} from "@/lib/rag/turbopuffer";

type SlidesData = {
  slides: Array<{
    title: string;
    bullets: string[];
    notes?: string;
    imageUrl?: string;
    imageCaption?: string;
  }>;
};

function isValidSlidesJson(content: string): boolean {
  if (!content) return false;
  try {
    const parsed = JSON.parse(content.trim()) as unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "slides" in parsed &&
      Array.isArray((parsed as SlidesData).slides)
    );
  } catch {
    return false;
  }
}

function extractSlidesJson(text: string): string | null {
  // Try to find JSON object with slides array
  const jsonMatch = text.match(/\{[\S\s]*"slides"[\S\s]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "slides" in parsed &&
        Array.isArray((parsed as SlidesData).slides)
      ) {
        return jsonMatch[0];
      }
    } catch {
      // Not valid JSON
    }
  }
  return null;
}

function getUserDisplayName(session: {
  user: { displayName?: string | null; email?: string | null };
}): string {
  if (session.user.displayName) {
    return session.user.displayName.split(/\s+/).at(0) ?? "User";
  }
  const email = session.user.email;
  if (typeof email === "string") {
    const localPart = email.split("@").at(0) ?? "";
    const namePart = localPart.split(/[._-]/).at(0) ?? localPart;
    return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
  }
  return "User";
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { instruction, currentContent, projectId, noteType, replyTo, agentId } =
      body as {
        instruction?: string;
        currentContent?: string;
        projectId?: string;
        noteType?: string;
        replyTo?: boolean;
        agentId?: string;
      };

    if (
      !instruction ||
      typeof instruction !== "string" ||
      instruction.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Instruction is required" },
        { status: 400 }
      );
    }

    if (instruction.length > 10000) {
      return NextResponse.json(
        { error: "Instruction too long (max 10000 characters)" },
        { status: 400 }
      );
    }

    // Retrieve document context if projectId is provided
    let documentContext = "";
    if (projectId) {
      const project = await getProjectByIdForUser({
        projectId,
        userId: session.user.id,
      });

      if (project) {
        const [docsNamespace] = namespacesForSourceTypes(
          ["docs"],
          project.id,
          project.isDefault
        );

        if (docsNamespace) {
          // Build a query based on the instruction
          const queryText = `${instruction} document content`;

          const rows = await queryTurbopuffer({
            query: queryText,
            topK: 8,
            namespace: docsNamespace,
          });

          documentContext = formatRetrievedContext(rows);
        }
      }
    }

    const model = myProvider.languageModel("chat-model");

    const hasExistingContent =
      currentContent && currentContent.trim().length > 0;

    // Detect if content is slides JSON
    const isSlidesContent =
      hasExistingContent && isValidSlidesJson(currentContent);

    let systemPrompt: string;
    let userPrompt: string;

    if (isSlidesContent) {
      // Slides-specific prompts
      systemPrompt = `You are a helpful presentation assistant. Your task is to update slide deck content based on user instructions.

Rules:
1. Output ONLY valid JSON in the exact same format as the input
2. The output must be a JSON object with a "slides" array
3. Each slide must have: "title" (string), "bullets" (array of strings)
4. Optional slide properties: "notes" (string), "imageUrl" (string), "imageCaption" (string)
5. Preserve the overall structure while making the requested changes
6. Keep slides concise and presentation-friendly
7. Return ONLY the JSON object, no explanations or code blocks${
        documentContext
          ? `

## Context from User's Project
The following are excerpts from documents in the user's project. Use this context to inform your writing with relevant details, terminology, and style:

${documentContext}`
          : ""
      }`;

      userPrompt = `Please update the following slide deck based on this instruction:

Instruction: ${instruction.trim()}

Current slide deck (JSON):
${currentContent}

Return ONLY the updated JSON object with the slides array. Do not wrap in code blocks.`;
    } else if (noteType === "email-thread" || noteType === "email-draft") {
      const userDisplayName = getUserDisplayName(session);
      let emailAgentPrompt = getEmailAgentSystemPrompt(userDisplayName);

      if (agentId && typeof agentId === "string" && agentId.trim()) {
        const id = agentId.trim();
        if (id === "email") {
          emailAgentPrompt = getEmailAgentSystemPrompt(userDisplayName);
        } else if (projectId && typeof projectId === "string") {
          const project = await getProjectByIdForUser({
            projectId,
            userId: session.user.id,
          });
          const doc =
            project &&
            (await getProjectDocById({ docId: id }));
          if (
            doc &&
            doc.projectId === project.id &&
            doc.documentType === "agent" &&
            doc.blobUrl
          ) {
            try {
              const res = await fetch(doc.blobUrl);
              if (res.ok) {
                const customPrompt = await res.text();
                if (customPrompt.trim()) {
                  emailAgentPrompt = customPrompt.trim();
                }
              }
            } catch {
              // keep default
            }
          }
        }
      }

      systemPrompt = `${emailAgentPrompt}

Rules:
1. Output ONLY the email content — no preamble, explanations, or meta-commentary
2. Preserve exact whitespace and line breaks as specified in the agent instructions, especially in signatures and footers
3. ${emailFormattingPrompt}${
        documentContext
          ? `

## Context from User's Project
The following are excerpts from documents in the user's project. Use this context to inform your email with relevant details:

${documentContext}`
          : ""
      }`;

      userPrompt =
        replyTo && hasExistingContent
          ? `The following is an email thread. Draft a reply based on this instruction: ${instruction.trim()}

Thread:
${currentContent}

Return only the reply email content.`
          : hasExistingContent
            ? `Please update or improve the following email based on this instruction:

Instruction: ${instruction.trim()}

Current content:
${currentContent}

Return the updated email content.`
            : `Please draft an email based on this instruction:

Instruction: ${instruction.trim()}

Return the email content.`;
    } else {
      systemPrompt = `You are a helpful document writing assistant. Your task is to generate or reformat markdown content based on user instructions.

Rules:
1. Output clean, well-formatted markdown
2. Use appropriate headings, lists, and formatting
3. Be concise but thorough
4. Match the tone and style appropriate for the content type
5. If reformatting existing content, preserve the key information while improving structure and clarity
6. If writing new content, be creative and comprehensive based on the instruction
7. Return ONLY the markdown content, no explanations or meta-commentary${
        documentContext
          ? `

## Context from User's Project
The following are excerpts from documents in the user's project. Use this context to inform your writing with relevant details, terminology, and style:

${documentContext}`
          : ""
      }`;

      userPrompt = hasExistingContent
        ? `Please reformat or update the following content based on this instruction:

Instruction: ${instruction.trim()}

Current content:
${currentContent}

Return the updated markdown content.`
        : `Please write new content based on this instruction:

Instruction: ${instruction.trim()}

Return the markdown content.`;
    }

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxRetries: 2,
    });

    const { usage } = result;
    if (usage) {
      const u = usage as {
        promptTokens?: number;
        completionTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
      };
      const promptTokens =
        typeof u.promptTokens === "number"
          ? u.promptTokens
          : typeof u.inputTokens === "number"
            ? u.inputTokens
            : undefined;
      const completionTokens =
        typeof u.completionTokens === "number"
          ? u.completionTokens
          : typeof u.outputTokens === "number"
            ? u.outputTokens
            : undefined;
      await insertUsageLog({
        userId: session.user.id,
        promptTokens,
        completionTokens,
      });
    }

    let content = result.text.trim();

    if (isSlidesContent) {
      // For slides, extract and validate JSON
      const extractedJson = extractSlidesJson(content);
      if (extractedJson) {
        content = extractedJson;
      } else {
        // Try to clean up common issues
        if (content.startsWith("```json")) {
          content = content.slice(7);
        } else if (content.startsWith("```")) {
          content = content.slice(3);
        }
        if (content.endsWith("```")) {
          content = content.slice(0, -3);
        }
        content = content.trim();

        // Validate the cleaned content is valid slides JSON
        if (!isValidSlidesJson(content)) {
          return NextResponse.json(
            { error: "Failed to generate valid slide deck" },
            { status: 500 }
          );
        }
      }
    } else {
      // Clean up the response - remove markdown code blocks if the model wrapped it
      if (content.startsWith("```markdown")) {
        content = content.slice(11);
      } else if (content.startsWith("```md")) {
        content = content.slice(5);
      } else if (content.startsWith("```")) {
        content = content.slice(3);
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3);
      }
      content = content.trim();
    }

    if (!content) {
      return NextResponse.json(
        { error: "Failed to generate content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ content }, { status: 200 });
  } catch (error) {
    console.error("[generate-doc] Error:", error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate content",
      },
      { status: 500 }
    );
  }
}
