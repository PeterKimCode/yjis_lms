-- Add an optional public homepage URL for organization-branded documents.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
