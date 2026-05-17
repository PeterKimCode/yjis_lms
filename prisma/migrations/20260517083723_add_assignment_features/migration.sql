-- AlterTable
ALTER TABLE "AssignmentSubmission" ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedById" TEXT;

-- CreateIndex
CREATE INDEX "AssignmentSubmission_gradedById_idx" ON "AssignmentSubmission"("gradedById");

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
