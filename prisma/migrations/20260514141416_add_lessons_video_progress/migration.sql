-- DropIndex
DROP INDEX "VideoProgress_studentId_materialId_key";

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "videoFileAssetId" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "VideoProgress" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "progressRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Lesson_videoFileAssetId_idx" ON "Lesson"("videoFileAssetId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_videoFileAssetId_fkey" FOREIGN KEY ("videoFileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
