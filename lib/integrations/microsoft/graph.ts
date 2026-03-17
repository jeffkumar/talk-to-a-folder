import "server-only";

import {
  getIntegrationConnectionForUser,
  upsertIntegrationConnection,
} from "@/lib/db/queries";
import { decryptSecret, encryptSecret } from "@/lib/integrations/crypto";

const MS_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

type TokenResponse = {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
};

function isExpired(expiresAt: Date | null) {
  if (!expiresAt) {
    return true;
  }
  return expiresAt.getTime() <= Date.now() + 60_000;
}

async function refreshMicrosoftTokens({
  refreshToken,
}: {
  refreshToken: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (typeof clientId !== "string" || clientId.length === 0) {
    throw new Error("MICROSOFT_CLIENT_ID is not set");
  }
  if (typeof clientSecret !== "string" || clientSecret.length === 0) {
    throw new Error("MICROSOFT_CLIENT_SECRET is not set");
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Token refresh failed");
  }

  const json = (await res.json()) as TokenResponse;
  const accessToken = json.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("Refresh response missing access_token");
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

  const nextRefresh =
    typeof json.refresh_token === "string" && json.refresh_token.length > 0
      ? json.refresh_token
      : null;

  return { accessToken, refreshToken: nextRefresh, expiresAt, scopes };
}

export async function getMicrosoftAccessTokenForUser(userId: string) {
  const connection = await getIntegrationConnectionForUser({
    userId,
    provider: "microsoft",
  });

  if (!connection || connection.revokedAt) {
    throw new Error("Microsoft not connected");
  }

  const currentAccessEnc = connection.accessTokenEnc;
  const currentRefreshEnc = connection.refreshTokenEnc;

  if (!currentAccessEnc) {
    throw new Error("Missing Microsoft access token");
  }

  if (!isExpired(connection.expiresAt ?? null)) {
    return decryptSecret(currentAccessEnc);
  }

  if (!currentRefreshEnc) {
    throw new Error("Microsoft session expired");
  }

  const refreshed = await refreshMicrosoftTokens({
    refreshToken: decryptSecret(currentRefreshEnc),
  });

  await upsertIntegrationConnection({
    userId,
    provider: "microsoft",
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

export async function graphJson<T>(userId: string, url: string) {
  const token = await getMicrosoftAccessTokenForUser(userId);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Graph request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export type UploadToMicrosoftDriveResult =
  | {
      success: true;
      lastModifiedDateTime: string;
      size: number;
    }
  | {
      success: false;
      error: string;
      conflictDetected?: boolean;
    };

/**
 * Upload file content to Microsoft OneDrive/SharePoint.
 * Uses PUT /drives/{driveId}/items/{itemId}/content for small files (<4MB).
 * For larger files, a resumable upload session would be needed.
 */
export async function uploadFileToMicrosoftDrive({
  userId,
  driveId,
  itemId,
  content,
  contentType,
  expectedLastModified,
}: {
  userId: string;
  driveId: string;
  itemId: string;
  content: string | Buffer;
  contentType: string;
  expectedLastModified?: string;
}): Promise<UploadToMicrosoftDriveResult> {
  const token = await getMicrosoftAccessTokenForUser(userId);

  // Check current file state if we have an expected lastModified (conflict detection)
  if (expectedLastModified) {
    try {
      const metaUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
      const metaRes = await fetch(metaUrl, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as {
          lastModifiedDateTime?: string;
        };
        if (
          meta.lastModifiedDateTime &&
          meta.lastModifiedDateTime !== expectedLastModified
        ) {
          return {
            success: false,
            error:
              "File was modified externally since you started editing. Please refresh and try again.",
            conflictDetected: true,
          };
        }
      }
    } catch {
      // If we can't check, proceed with upload anyway
    }
  }

  const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`;

  const buffer =
    typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  const body = new Uint8Array(buffer);

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 409) {
      return {
        success: false,
        error: "Conflict: file was modified. Please refresh and try again.",
        conflictDetected: true,
      };
    }
    if (res.status === 403) {
      return {
        success: false,
        error:
          "Permission denied. You may need to reconnect your Microsoft account with write permissions.",
      };
    }
    return {
      success: false,
      error: text || `Upload failed (${res.status})`,
    };
  }

  const json = (await res.json()) as {
    lastModifiedDateTime?: string;
    size?: number;
  };

  return {
    success: true,
    lastModifiedDateTime: json.lastModifiedDateTime ?? new Date().toISOString(),
    size: json.size ?? body.length,
  };
}
