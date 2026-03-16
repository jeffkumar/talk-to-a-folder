import crypto from "node:crypto";

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function sha256Base64Url(input: string) {
  const hash = crypto.createHash("sha256").update(input).digest();
  return base64UrlEncode(hash);
}

export function createPkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = sha256Base64Url(verifier);
  return { verifier, challenge };
}

export function createState() {
  return base64UrlEncode(crypto.randomBytes(16));
}
