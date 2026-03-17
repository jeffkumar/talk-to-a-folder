import { isSupportedMimeType as checkSupportedMimeType } from "@/lib/constants/file-types";
import {
  getIntegrationConnectionForUser,
  upsertIntegrationConnection,
} from "@/lib/db/queries";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return true;
  }
  // Consider expired if within 5 minutes of expiry
  return expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
}

async function refreshGoogleTokens({
  refreshToken,
}: {
  refreshToken: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token refresh failed: ${text}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (typeof json.access_token !== "string") {
    throw new Error("Missing access_token in refresh response");
  }

  const expiresInSec =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? json.expires_in
      : null;
  const expiresAt = expiresInSec
    ? new Date(Date.now() + expiresInSec * 1000)
    : null;

  const scopes =
    typeof json.scope === "string" && json.scope.length > 0
      ? json.scope.split(/\s+/).filter((s) => s.length > 0)
      : [];

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
    scopes,
  };
}

export async function getGoogleAccessTokenForUser(userId: string) {
  const connection = await getIntegrationConnectionForUser({
    userId,
    provider: "google",
  });

  if (!connection || connection.revokedAt) {
    throw new Error("Google not connected");
  }

  const currentAccessEnc = connection.accessTokenEnc;
  const currentRefreshEnc = connection.refreshTokenEnc;

  if (!currentAccessEnc) {
    throw new Error("Missing Google access token");
  }

  if (!isExpired(connection.expiresAt ?? null)) {
    return decryptSecret(currentAccessEnc);
  }

  if (!currentRefreshEnc) {
    throw new Error("Google session expired");
  }

  const refreshed = await refreshGoogleTokens({
    refreshToken: decryptSecret(currentRefreshEnc),
  });

  await upsertIntegrationConnection({
    userId,
    provider: "google",
    accountEmail: connection.accountEmail,
    providerAccountId: connection.providerAccountId,
    tenantId: connection.tenantId,
    scopes: refreshed.scopes.length > 0 ? refreshed.scopes : connection.scopes,
    accessTokenEnc: encryptSecret(refreshed.accessToken),
    refreshTokenEnc: refreshed.refreshToken
      ? encryptSecret(refreshed.refreshToken)
      : connection.refreshTokenEnc,
    expiresAt: refreshed.expiresAt,
  });

  return refreshed.accessToken;
}

export async function driveJson<T>(userId: string, url: string): Promise<T> {
  const token = await getGoogleAccessTokenForUser(userId);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Drive API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
  modifiedTime?: string;
};

export type DriveFileList = {
  files: DriveFile[];
  nextPageToken?: string;
};

export function isSupportedMimeType(mimeType: string): boolean {
  return checkSupportedMimeType(mimeType);
}

export async function downloadGoogleDriveFile({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string;
}): Promise<{ content: Buffer; mimeType: string }> {
  const token = await getGoogleAccessTokenForUser(userId);

  // First get file metadata to check mimeType
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=mimeType,name`;
  const metaRes = await fetch(metaUrl, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!metaRes.ok) {
    throw new Error("Failed to get file metadata");
  }

  const meta = (await metaRes.json()) as { mimeType: string; name: string };

  // For Google Docs/Sheets/Slides, we need to export them
  const googleDocsMimeTypes: Record<string, string> = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.spreadsheet":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.presentation": "application/pdf",
  };

  let downloadUrl: string;
  let finalMimeType: string;

  if (googleDocsMimeTypes[meta.mimeType]) {
    // Export Google Docs format
    const exportMime = googleDocsMimeTypes[meta.mimeType];
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime)}`;
    finalMimeType = exportMime;
  } else {
    // Direct download
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    finalMimeType = meta.mimeType;
  }

  const contentRes = await fetch(downloadUrl, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!contentRes.ok) {
    const text = await contentRes.text().catch(() => "");
    throw new Error(`Failed to download file: ${text}`);
  }

  const arrayBuffer = await contentRes.arrayBuffer();
  return {
    content: Buffer.from(arrayBuffer),
    mimeType: finalMimeType,
  };
}
