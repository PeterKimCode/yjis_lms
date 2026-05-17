-- CreateTable
CREATE TABLE "ClassSectionGradingConfig" (
    "id" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "lessonsWeight" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "attendanceWeight" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "assignmentsWeight" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "quizzesWeight" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "examsWeight" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSectionGradingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassSectionGradingConfig_classSectionId_key" ON "ClassSectionGradingConfig"("classSectionId");

-- CreateIndex
CREATE INDEX "ClassSectionGradingConfig_createdAt_idx" ON "ClassSectionGradingConfig"("createdAt");

-- AddForeignKey
ALTER TABLE "ClassSectionGradingConfig" ADD CONSTRAINT "ClassSectionGradingConfig_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
