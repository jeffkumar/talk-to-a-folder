CREATE TABLE IF NOT EXISTS "UsageLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
  "promptTokens" bigint,
  "completionTokens" bigint,
  "createdAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "usage_log_user_created_idx" ON "UsageLog" ("userId", "createdAt");
