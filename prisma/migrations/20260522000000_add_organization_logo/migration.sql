-- Add optional organization logo support.
ALTER TABLE "Organization" ADD COLUMN "logoFileAssetId" TEXT;

ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_logoFileAssetId_fkey"
  FOREIGN KEY ("logoFileAssetId")
  REFERENCES "FileAsset"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "Organization_logoFileAssetId_idx" ON "Organization"("logoFileAssetId");
