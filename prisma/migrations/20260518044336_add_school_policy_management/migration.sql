-- AlterTable
ALTER TABLE "AcademicPolicy" ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "classSectionId" TEXT;

-- AlterTable
ALTER TABLE "AttendancePolicy" ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "classSectionId" TEXT;

-- AlterTable
ALTER TABLE "GradingPolicy" ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "classSectionId" TEXT;

-- AlterTable
ALTER TABLE "VideoCompletionPolicy" ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "classSectionId" TEXT;

-- CreateIndex
CREATE INDEX "AcademicPolicy_campusId_idx" ON "AcademicPolicy"("campusId");

-- CreateIndex
CREATE INDEX "AcademicPolicy_classSectionId_idx" ON "AcademicPolicy"("classSectionId");

-- CreateIndex
CREATE INDEX "AttendancePolicy_campusId_idx" ON "AttendancePolicy"("campusId");

-- CreateIndex
CREATE INDEX "AttendancePolicy_classSectionId_idx" ON "AttendancePolicy"("classSectionId");

-- CreateIndex
CREATE INDEX "GradingPolicy_campusId_idx" ON "GradingPolicy"("campusId");

-- CreateIndex
CREATE INDEX "GradingPolicy_classSectionId_idx" ON "GradingPolicy"("classSectionId");

-- CreateIndex
CREATE INDEX "VideoCompletionPolicy_campusId_idx" ON "VideoCompletionPolicy"("campusId");

-- CreateIndex
CREATE INDEX "VideoCompletionPolicy_classSectionId_idx" ON "VideoCompletionPolicy"("classSectionId");

-- AddForeignKey
ALTER TABLE "AcademicPolicy" ADD CONSTRAINT "AcademicPolicy_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicPolicy" ADD CONSTRAINT "AcademicPolicy_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "AttendancePolicy_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoCompletionPolicy" ADD CONSTRAINT "VideoCompletionPolicy_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoCompletionPolicy" ADD CONSTRAINT "VideoCompletionPolicy_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingPolicy" ADD CONSTRAINT "GradingPolicy_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingPolicy" ADD CONSTRAINT "GradingPolicy_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
