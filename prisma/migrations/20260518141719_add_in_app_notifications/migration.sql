/*
  Warnings:

  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEW_BOARD_POST';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_BOARD_COMMENT';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_GRADED';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_QUIZ';
ALTER TYPE "NotificationType" ADD VALUE 'QUIZ_GRADED';
ALTER TYPE "NotificationType" ADD VALUE 'FINAL_GRADE_PUBLISHED';
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_CARD_AVAILABLE';
ALTER TYPE "NotificationType" ADD VALUE 'TRANSCRIPT_AVAILABLE';
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_NOTICE';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
