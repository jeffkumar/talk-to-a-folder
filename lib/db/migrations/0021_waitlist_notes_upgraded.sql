ALTER TABLE "WaitlistRequest" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
ALTER TABLE "WaitlistRequest" ADD COLUMN IF NOT EXISTS "upgradedAt" timestamp;
