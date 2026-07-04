CREATE TABLE "ResourceDeletionRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campusId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityName" TEXT NOT NULL,
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "reason" TEXT,
  "status" "UserDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResourceDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResourceDeletionRequest_organizationId_idx" ON "ResourceDeletionRequest"("organizationId");
CREATE INDEX "ResourceDeletionRequest_campusId_idx" ON "ResourceDeletionRequest"("campusId");
CREATE INDEX "ResourceDeletionRequest_entityType_entityId_idx" ON "ResourceDeletionRequest"("entityType", "entityId");
CREATE INDEX "ResourceDeletionRequest_requestedById_idx" ON "ResourceDeletionRequest"("requestedById");
CREATE INDEX "ResourceDeletionRequest_reviewedById_idx" ON "ResourceDeletionRequest"("reviewedById");
CREATE INDEX "ResourceDeletionRequest_status_idx" ON "ResourceDeletionRequest"("status");
CREATE INDEX "ResourceDeletionRequest_requestedAt_idx" ON "ResourceDeletionRequest"("requestedAt");

ALTER TABLE "ResourceDeletionRequest"
  ADD CONSTRAINT "ResourceDeletionRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResourceDeletionRequest"
  ADD CONSTRAINT "ResourceDeletionRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceDeletionRequest"
  ADD CONSTRAINT "ResourceDeletionRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
