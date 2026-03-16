-- Add archivedAt column to ProjectDoc for note archiving feature
ALTER TABLE "ProjectDoc" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;
