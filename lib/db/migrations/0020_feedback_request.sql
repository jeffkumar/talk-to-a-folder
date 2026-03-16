CREATE TABLE IF NOT EXISTS "FeedbackRequest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" varchar NOT NULL DEFAULT 'open',
	"createdAt" timestamp NOT NULL,
	"resolvedAt" timestamp,
	"resolvedBy" uuid
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_request_user_idx" ON "FeedbackRequest" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_request_status_idx" ON "FeedbackRequest" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_request_type_idx" ON "FeedbackRequest" ("type");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_resolvedBy_User_id_fk" FOREIGN KEY ("resolvedBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
