import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getProjectByIdForUser,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

const requestSchema = z.object({
  chatId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  slidesJson: z.string(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let requestBody: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    requestBody = requestSchema.parse(json);
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const { chatId, projectId, title, slidesJson } = requestBody;

  try {
    // Verify project access
    const project = await getProjectByIdForUser({
      projectId,
      userId: session.user.id,
    });

    if (!project) {
      return new ChatSDKError("not_found:database").toResponse();
    }

    // Create the chat
    await saveChat({
      id: chatId,
      userId: session.user.id,
      projectId,
      title: `Presentation: ${title}`,
      visibility: "private",
    });

    // Create the messages
    const userMessageId = generateUUID();
    const assistantMessageId = generateUUID();
    const now = new Date();

    await saveMessages({
      messages: [
        {
          id: userMessageId,
          chatId,
          role: "user",
          parts: [{ type: "text", text: `Create a presentation: ${title}` }],
          attachments: [],
          createdAt: now,
        },
        {
          id: assistantMessageId,
          chatId,
          role: "assistant",
          parts: [{ type: "text", text: slidesJson }],
          attachments: [],
          createdAt: new Date(now.getTime() + 1), // 1ms later to ensure order
        },
      ],
    });

    return Response.json({
      success: true,
      chatId,
    });
  } catch (error) {
    console.error("Save slides chat error:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to save slides chat"
    ).toResponse();
  }
}
