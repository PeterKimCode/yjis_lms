-- Preserve the existing material progress uniqueness while allowing lessons
-- to track progress without a dedicated unique constraint.
CREATE UNIQUE INDEX "VideoProgress_studentId_materialId_key" ON "VideoProgress"("studentId", "materialId");
