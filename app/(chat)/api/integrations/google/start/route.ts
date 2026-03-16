import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { isDevelopmentEnvironment } from "@/lib/constants";
import { createPkcePair, createState } from "@/lib/integrations/google/oauth";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const DEFAULT_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
];

function getRequestBaseUrl(request: Request): URL {
  const url = new URL(request.url);
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost ?? request.headers.get("host") ?? url.host;
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  return new URL(`${proto}://${host}`);
}

function pickGoogleRedirectUri({ request }: { request: Request }): string {
  const baseUrl = getRequestBaseUrl(request);
  const derived = new URL(
    "/api/integrations/google/callback",
    baseUrl
  ).toString();
  const configured = process.env.GOOGLE_REDIRECT_URI;

  if (typeof configured === "string" && configured.length > 0) {
    try {
      const configuredUrl = new URL(configured);
      if (configuredUrl.host === baseUrl.host) {
        return configuredUrl.toString();
      }
    } catch {
      // Ignore invalid configured URL and fall back to derived.
    }
  }

  return derived;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = pickGoogleRedirectUri({ request });

  if (typeof clientId !== "string" || clientId.length === 0) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not set" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") ?? "/integrations";

  const { verifier, challenge } = createPkcePair();
  const state = createState();

  const authorizeUrl = new URL(GOOGLE_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", DEFAULT_SCOPES.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent");

  const response = NextResponse.redirect(authorizeUrl);

  const originHost = new URL(request.url).host;
  const cookieBase = {
    httpOnly: true,
    sameSite: isDevelopmentEnvironment ? ("lax" as const) : ("none" as const),
    secure: !isDevelopmentEnvironment,
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  };

  response.cookies.set({
    name: "google_oauth_state",
    value: state,
    ...cookieBase,
  });
  response.cookies.set({
    name: "google_pkce_verifier",
    value: verifier,
    ...cookieBase,
  });
  response.cookies.set({
    name: "google_return_to",
    value: returnTo,
    ...cookieBase,
  });
  response.cookies.set({
    name: "google_oauth_origin_host",
    value: originHost,
    ...cookieBase,
  });

  response.headers.set("cache-control", "no-store");
  return response;
}
