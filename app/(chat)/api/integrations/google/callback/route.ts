import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { isDevelopmentEnvironment } from "@/lib/constants";
import { upsertIntegrationConnection } from "@/lib/db/queries";
import { encryptSecret } from "@/lib/integrations/crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const QuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  error_description: z.string().min(1).optional(),
});

type TokenResponse = {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
};

type UserInfo = {
  id?: string;
  email?: string;
  name?: string;
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (typeof clientId !== "string" || clientId.length === 0) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not set" },
      { status: 500 }
    );
  }
  if (typeof clientSecret !== "string" || clientSecret.length === 0) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_SECRET is not set" },
      { status: 500 }
    );
  }
  if (typeof redirectUri !== "string" || redirectUri.length === 0) {
    return NextResponse.json(
      { error: "GOOGLE_REDIRECT_URI is not set" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid callback query" },
      { status: 400 }
    );
  }

  const { code, state, error, error_description } = parsed.data;
  if (error) {
    return NextResponse.json(
      { error, error_description: error_description ?? null },
      { status: 400 }
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  const verifier = cookieStore.get("google_pkce_verifier")?.value;
  const returnTo =
    cookieStore.get("google_return_to")?.value ?? "/integrations";
  const originHost = cookieStore.get("google_oauth_origin_host")?.value ?? null;

  if (!expectedState || !verifier || expectedState !== state) {
    console.error("[google oauth] invalid state", {
      originHost,
      callbackHost: new URL(request.url).host,
      forwardedHost: request.headers.get("x-forwarded-host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
      hasCookieHeader: (request.headers.get("cookie") ?? "").length > 0,
      hasExpectedStateCookie: Boolean(expectedState),
      hasVerifierCookie: Boolean(verifier),
      statePrefix: state.slice(0, 6),
      expectedStatePrefix: expectedState ? expectedState.slice(0, 6) : null,
    });

    const response = NextResponse.redirect(
      new URL("/integrations?googleError=invalid_state", request.url)
    );

    const cookieBase = {
      httpOnly: true,
      sameSite: isDevelopmentEnvironment ? ("lax" as const) : ("none" as const),
      secure: !isDevelopmentEnvironment,
      path: "/",
    };

    response.cookies.set({
      name: "google_oauth_state",
      value: "",
      maxAge: 0,
      ...cookieBase,
    });
    response.cookies.set({
      name: "google_pkce_verifier",
      value: "",
      maxAge: 0,
      ...cookieBase,
    });
    response.cookies.set({
      name: "google_return_to",
      value: "",
      maxAge: 0,
      ...cookieBase,
    });
    response.cookies.set({
      name: "google_oauth_origin_host",
      value: "",
      maxAge: 0,
      ...cookieBase,
    });

    response.headers.set("cache-control", "no-store");
    return response;
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("code_verifier", verifier);

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Token exchange failed", details: text || null },
      { status: 400 }
    );
  }

  const tokenJson = (await tokenRes.json()) as TokenResponse;
  const accessToken = tokenJson.access_token;
  const refreshToken = tokenJson.refresh_token;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return NextResponse.json(
      { error: "Missing access_token" },
      { status: 400 }
    );
  }

  // Get user info
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    const text = await userRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Userinfo failed", details: text || null },
      { status: 400 }
    );
  }

  const userInfo = (await userRes.json()) as UserInfo;
  const providerAccountId =
    typeof userInfo.id === "string" && userInfo.id.length > 0
      ? userInfo.id
      : null;
  const accountEmail =
    typeof userInfo.email === "string" && userInfo.email.length > 0
      ? userInfo.email
      : null;

  const expiresInSec =
    typeof tokenJson.expires_in === "number" &&
    Number.isFinite(tokenJson.expires_in)
      ? tokenJson.expires_in
      : null;
  const expiresAt = expiresInSec
    ? new Date(Date.now() + expiresInSec * 1000)
    : null;

  const scopes =
    typeof tokenJson.scope === "string" && tokenJson.scope.length > 0
      ? tokenJson.scope.split(/\s+/).filter((s) => s.length > 0)
      : [];

  const accessTokenEnc = encryptSecret(accessToken);
  const refreshTokenEnc =
    typeof refreshToken === "string" && refreshToken.length > 0
      ? encryptSecret(refreshToken)
      : null;

  await upsertIntegrationConnection({
    userId: session.user.id,
    provider: "google",
    accountEmail,
    providerAccountId,
    tenantId: null, // Google doesn't have tenants like Microsoft
    scopes,
    accessTokenEnc,
    refreshTokenEnc,
    expiresAt,
  });

  const response = NextResponse.redirect(new URL(returnTo, request.url));

  const cookieBase = {
    httpOnly: true,
    sameSite: isDevelopmentEnvironment ? ("lax" as const) : ("none" as const),
    secure: !isDevelopmentEnvironment,
    path: "/",
  };

  response.cookies.set({
    name: "google_oauth_state",
    value: "",
    maxAge: 0,
    ...cookieBase,
  });
  response.cookies.set({
    name: "google_pkce_verifier",
    value: "",
    maxAge: 0,
    ...cookieBase,
  });
  response.cookies.set({
    name: "google_return_to",
    value: "",
    maxAge: 0,
    ...cookieBase,
  });
  response.cookies.set({
    name: "google_oauth_origin_host",
    value: "",
    maxAge: 0,
    ...cookieBase,
  });

  return response;
}
