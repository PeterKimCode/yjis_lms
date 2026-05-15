-- Add explicit K-12 homeroom placement to student profiles.
ALTER TABLE "StudentProfile" ADD COLUMN "homeroomId" TEXT;

CREATE INDEX "StudentProfile_homeroomId_idx" ON "StudentProfile"("homeroomId");

ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_homeroomId_fkey" FOREIGN KEY ("homeroomId") REFERENCES "Homeroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
