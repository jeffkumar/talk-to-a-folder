import { sendContactRequestEmail } from "@/lib/email";
import { ChatSDKError } from "@/lib/errors";

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 5000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || name.length > MAX_NAME) {
      return new ChatSDKError(
        "bad_request:contact",
        "Name is required and must be under 200 characters."
      ).toResponse();
    }

    if (!EMAIL_REGEX.test(email) || email.length > MAX_EMAIL) {
      return new ChatSDKError(
        "bad_request:contact",
        "Valid email is required."
      ).toResponse();
    }

    if (!message || message.length > MAX_MESSAGE) {
      return new ChatSDKError(
        "bad_request:contact",
        "Message is required and must be under 5000 characters."
      ).toResponse();
    }

    await sendContactRequestEmail({ name, email, message });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("Contact API error:", error);
    return new ChatSDKError("offline:contact").toResponse();
  }
}
