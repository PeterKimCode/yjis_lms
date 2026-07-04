CREATE TYPE "UserDeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "UserDeletionRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "targetUserName" TEXT NOT NULL,
  "targetUserLoginId" TEXT,
  "reason" TEXT,
  "status" "UserDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserDeletionRequest_organizationId_idx" ON "UserDeletionRequest"("organizationId");
CREATE INDEX "UserDeletionRequest_targetUserId_idx" ON "UserDeletionRequest"("targetUserId");
CREATE INDEX "UserDeletionRequest_requestedById_idx" ON "UserDeletionRequest"("requestedById");
CREATE INDEX "UserDeletionRequest_reviewedById_idx" ON "UserDeletionRequest"("reviewedById");
CREATE INDEX "UserDeletionRequest_status_idx" ON "UserDeletionRequest"("status");
CREATE INDEX "UserDeletionRequest_requestedAt_idx" ON "UserDeletionRequest"("requestedAt");

ALTER TABLE "UserDeletionRequest"
  ADD CONSTRAINT "UserDeletionRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDeletionRequest"
  ADD CONSTRAINT "UserDeletionRequest_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserDeletionRequest"
  ADD CONSTRAINT "UserDeletionRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserDeletionRequest"
  ADD CONSTRAINT "UserDeletionRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
