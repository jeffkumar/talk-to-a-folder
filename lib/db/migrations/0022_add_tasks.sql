-- Add Task table for project tasks with assignments and status tracking
CREATE TABLE IF NOT EXISTS "Task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "projectId" uuid NOT NULL REFERENCES "Project"("id"),
  "createdBy" uuid NOT NULL REFERENCES "User"("id"),
  "assigneeId" uuid REFERENCES "User"("id"),
  "title" text NOT NULL,
  "description" text,
  "status" varchar NOT NULL DEFAULT 'todo',
  "priority" varchar NOT NULL DEFAULT 'medium',
  "startDate" date,
  "endDate" date,
  "sourceDocId" uuid REFERENCES "ProjectDoc"("id"),
  "turbopufferNamespace" text,
  "indexedAt" timestamp,
  "createdAt" timestamp NOT NULL,
  "completedAt" timestamp,
  
  CONSTRAINT "task_status_check" CHECK ("status" IN ('todo', 'in_progress', 'in_review', 'completed', 'cancelled')),
  CONSTRAINT "task_priority_check" CHECK ("priority" IN ('urgent', 'high', 'medium', 'low'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "task_project_idx" ON "Task" ("projectId");
CREATE INDEX IF NOT EXISTS "task_assignee_idx" ON "Task" ("assigneeId");
CREATE INDEX IF NOT EXISTS "task_status_idx" ON "Task" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "task_priority_idx" ON "Task" ("projectId", "priority");
CREATE INDEX IF NOT EXISTS "task_end_date_idx" ON "Task" ("projectId", "endDate");
