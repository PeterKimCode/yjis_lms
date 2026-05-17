-- AlterTable
ALTER TABLE "GradeScore" ADD COLUMN     "gradedById" TEXT;

-- CreateIndex
CREATE INDEX "GradeScore_gradedById_idx" ON "GradeScore"("gradedById");

-- AddForeignKey
ALTER TABLE "GradeScore" ADD CONSTRAINT "GradeScore_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
