import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getGoogleAccessTokenForUser } from "@/lib/integrations/google/drive";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getGoogleAccessTokenForUser(session.user.id);
    return NextResponse.json({ accessToken });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
