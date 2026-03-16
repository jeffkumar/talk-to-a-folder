"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { titlePrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import type { VisibilityType } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function saveAgentModeAsCookie(mode: string) {
  const cookieStore = await cookies();
  cookieStore.set("agent-mode", mode);
}

/**
 * Try to extract a user-friendly title from slides JSON content.
 * Returns a title if slides data is found, null otherwise.
 */
function extractTitleFromSlidesJson(text: string): string | null {
  if (!text) return null;

  // Check if the text contains slides JSON pattern
  const slidesMatch = text.match(/["']?slides["']?\s*:\s*\[/);
  if (!slidesMatch) return null;

  try {
    // Try to find and parse the JSON
    let jsonText = text;

    // If wrapped in code blocks, extract the content
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    // Find the start of the JSON object
    const startIndex = jsonText.indexOf('{"slides"');
    if (startIndex === -1) {
      const altStartIndex = jsonText.indexOf('{"slides"');
      if (altStartIndex === -1) return null;
    }

    const objStart = jsonText.indexOf("{");
    if (objStart === -1) return null;

    // Try to parse from that point
    const parsed = JSON.parse(jsonText.slice(objStart));

    if (
      parsed?.slides &&
      Array.isArray(parsed.slides) &&
      parsed.slides.length > 0
    ) {
      const firstSlide = parsed.slides[0];
      if (firstSlide?.title && typeof firstSlide.title === "string") {
        // Return a clean title based on the first slide
        const slideTitle = firstSlide.title.trim();
        if (slideTitle.length > 0 && slideTitle.length <= 60) {
          return `Presentation: ${slideTitle}`;
        }
        if (slideTitle.length > 60) {
          return `Presentation: ${slideTitle.slice(0, 57)}...`;
        }
      }
      return "Presentation";
    }
  } catch {
    // JSON parsing failed - this might be partial/invalid JSON
    // Try a regex-based extraction as fallback
    const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/);
    if (titleMatch?.[1]) {
      const extractedTitle = titleMatch[1].trim();
      if (extractedTitle.length > 0 && extractedTitle.length <= 60) {
        return `Presentation: ${extractedTitle}`;
      }
      if (extractedTitle.length > 60) {
        return `Presentation: ${extractedTitle.slice(0, 57)}...`;
      }
    }
  }

  return null;
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const textContent = getTextFromMessage(message);

  // Check if the message contains slides JSON data
  // If so, extract a user-friendly title from it instead of generating one
  const slidesTitle = extractTitleFromSlidesJson(textContent);
  if (slidesTitle) {
    return slidesTitle;
  }

  if (/drive\.google\.com\/drive\/folders\//.test(textContent)) {
    return "Folder Chat";
  }

  // Baseten's DeepSeek model may have issues with structured/multimedia input
  // even if provided as a simple prompt string if the underlying provider logic sends it as a complex object.
  // We ensure it is sent as a simple user message.

  const { text: title } = await generateText({
    model: myProvider.languageModel("title-model"),
    system: titlePrompt,
    messages: [
      {
        role: "user",
        content: textContent,
      },
    ],
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisibilityById({ chatId, visibility });
}
