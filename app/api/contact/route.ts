import { NextResponse } from "next/server";
import { sendContactRequestEmail } from "@/lib/email";

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 5000;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!name || name.length > MAX_NAME) {
      return NextResponse.json(
        { error: "Name is required and must be under 200 characters." },
        { status: 400 }
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > MAX_EMAIL) {
      return NextResponse.json(
        { error: "Valid email is required." },
        { status: 400 }
      );
    }
    if (!message || message.length > MAX_MESSAGE) {
      return NextResponse.json(
        { error: "Message is required and must be under 5000 characters." },
        { status: 400 }
      );
    }

    await sendContactRequestEmail({ name, email, message });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json(
      {
        error:
          "Failed to send your message. Please try again or email us directly.",
      },
      { status: 500 }
    );
  }
}
