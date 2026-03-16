-- Add name column to User table
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "name" varchar(128);

-- Add name column to WaitlistRequest table
ALTER TABLE "WaitlistRequest"
  ADD COLUMN IF NOT EXISTS "name" varchar(128);
