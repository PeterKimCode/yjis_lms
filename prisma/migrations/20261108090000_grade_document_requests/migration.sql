-- CreateEnum
CREATE TYPE "GradeDocumentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "GradeDocumentRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "status" "GradeDocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "pendingKey" TEXT,
    "termLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "previewById" TEXT,
    "previewToken" TEXT,
    "previewFingerprint" TEXT,
    "pdf" BYTEA,
    "filename" TEXT,

    CONSTRAINT "GradeDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeDocumentRequest_status_createdAt_idx" ON "GradeDocumentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GradeDocumentRequest_studentId_documentType_status_idx" ON "GradeDocumentRequest"("studentId", "documentType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GradeDocumentRequest_studentId_pendingKey_key" ON "GradeDocumentRequest"("studentId", "pendingKey");

-- AddForeignKey
ALTER TABLE "GradeDocumentRequest" ADD CONSTRAINT "GradeDocumentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeDocumentRequest" ADD CONSTRAINT "GradeDocumentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeDocumentRequest" ADD CONSTRAINT "GradeDocumentRequest_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
