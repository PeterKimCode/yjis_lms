CREATE TABLE "AssignmentAttachment" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AssignmentAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuizAttachment" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuizAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamAttachment" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExamAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentAttachment_assignmentId_fileAssetId_key" ON "AssignmentAttachment"("assignmentId", "fileAssetId");
CREATE INDEX "AssignmentAttachment_assignmentId_idx" ON "AssignmentAttachment"("assignmentId");
CREATE INDEX "AssignmentAttachment_fileAssetId_idx" ON "AssignmentAttachment"("fileAssetId");

CREATE UNIQUE INDEX "QuizAttachment_quizId_fileAssetId_key" ON "QuizAttachment"("quizId", "fileAssetId");
CREATE INDEX "QuizAttachment_quizId_idx" ON "QuizAttachment"("quizId");
CREATE INDEX "QuizAttachment_fileAssetId_idx" ON "QuizAttachment"("fileAssetId");

CREATE UNIQUE INDEX "ExamAttachment_examId_fileAssetId_key" ON "ExamAttachment"("examId", "fileAssetId");
CREATE INDEX "ExamAttachment_examId_idx" ON "ExamAttachment"("examId");
CREATE INDEX "ExamAttachment_fileAssetId_idx" ON "ExamAttachment"("fileAssetId");

ALTER TABLE "AssignmentAttachment"
  ADD CONSTRAINT "AssignmentAttachment_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentAttachment"
  ADD CONSTRAINT "AssignmentAttachment_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizAttachment"
  ADD CONSTRAINT "QuizAttachment_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizAttachment"
  ADD CONSTRAINT "QuizAttachment_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamAttachment"
  ADD CONSTRAINT "ExamAttachment_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamAttachment"
  ADD CONSTRAINT "ExamAttachment_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
