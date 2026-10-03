BEGIN;
ALTER TABLE "Quiz" ADD COLUMN "assessmentType" TEXT NOT NULL DEFAULT 'QUIZ', ADD COLUMN "location" TEXT, ADD COLUMN "archivedAt" TIMESTAMP(3);
-- Keep existing Exam IDs and grade references; Quiz becomes the schedule/response source.
DO $$ DECLARE e RECORD; qid TEXT; BEGIN
FOR e IN SELECT * FROM "Exam" ORDER BY "createdAt", "id" LOOP
  qid := e."quizId";
  IF qid IS NULL THEN
    qid := 'legacy_exam_' || e.id;
    INSERT INTO "Quiz" (id,"organizationId","classSectionId",title,description,"opensAt","closesAt","pointsPossible","isPublished","maxAttempts","createdAt","updatedAt")
      VALUES(qid,e."organizationId",e."classSectionId",e.title,e.description,e."startsAt",e."endsAt",e."pointsPossible",true,1,e."createdAt",CURRENT_TIMESTAMP);
    UPDATE "Exam" SET "quizId"=qid WHERE id=e.id;
  END IF;
  UPDATE "Quiz" SET "assessmentType"=CASE e."examType" WHEN 'MIDTERM' THEN 'MIDTERM' WHEN 'FINAL' THEN 'FINAL' WHEN 'MONTHLY' THEN 'MONTHLY' ELSE 'OTHER' END,
    "location"=e.location,"opensAt"=e."startsAt","closesAt"=e."endsAt" WHERE id=qid;
  INSERT INTO "QuizAttachment" (id,"quizId","fileAssetId","createdAt")
    SELECT 'legacy_qa_' || a.id,qid,a."fileAssetId",a."createdAt" FROM "ExamAttachment" a WHERE a."examId"=e.id ON CONFLICT ("quizId","fileAssetId") DO NOTHING;
  IF EXISTS(SELECT 1 FROM "QuizAttachment" WHERE "quizId"=qid) AND NOT EXISTS(SELECT 1 FROM "Question" WHERE "quizId"=qid) THEN
    INSERT INTO "Question" (id,"organizationId","quizId",type,prompt,points,sequence,"createdAt","updatedAt")
      VALUES('legacy_answer_' || e.id,e."organizationId",qid,'ESSAY','Read the attached exam paper and write your answers below.',COALESCE(e."pointsPossible",100),1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  END IF;
END LOOP; END $$;
COMMIT;
