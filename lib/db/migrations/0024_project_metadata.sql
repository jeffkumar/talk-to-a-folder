-- Add metadata JSONB field to Project table for storing noteLabels and other project-level settings
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
