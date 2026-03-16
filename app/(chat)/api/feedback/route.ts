import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createFeedbackRequest } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, title, description } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: type, title, and description" },
        { status: 400 }
      );
    }

    if (type !== "bug" && type !== "feature") {
      return NextResponse.json(
        { error: "Invalid type. Must be 'bug' or 'feature'" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title must be a non-empty string" },
        { status: 400 }
      );
    }

    if (typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description must be a non-empty string" },
        { status: 400 }
      );
    }

    const feedback = await createFeedbackRequest({
      userId: session.user.id,
      type,
      title: title.trim(),
      description: description.trim(),
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to create feedback request"
    ).toResponse();
  }
}
