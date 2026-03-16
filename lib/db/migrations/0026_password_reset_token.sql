CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "token" varchar(64) NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "usedAt" timestamp,
  "createdAt" timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_idx" ON "PasswordResetToken" ("token");
