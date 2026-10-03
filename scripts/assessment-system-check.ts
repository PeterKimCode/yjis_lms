import assert from "node:assert/strict"
import { test } from "node:test"
import {
  dateTimeLocalInTimeZone,
  formatDateTimeInTimeZone,
  parseDateTimeLocalInTimeZone
} from "../src/lib/timezone"
import {
  resolveInstructorClassSelection,
  instructorSelectionForHash
} from "../src/modules/dashboards/instructor-class-navigation"
import { validateAssessmentAnswers } from "../src/modules/quizzes/answer-validation"
test("school schedule round trips across browser/server time zones", () => {
  const original = process.env.TZ
  try {
    for (const hostZone of ["UTC", "America/New_York", "Asia/Seoul"]) {
      process.env.TZ = hostZone
      for (const schoolZone of [
        "Asia/Seoul",
        "Asia/Manila",
        "America/New_York"
      ]) {
        const wall = "2026-10-05T00:15",
          instant = parseDateTimeLocalInTimeZone(wall, schoolZone)!
        assert.equal(dateTimeLocalInTimeZone(instant, schoolZone), wall)
        assert.match(
          formatDateTimeInTimeZone(instant, schoolZone),
          /Oct 5, 2026/
        )
      }
    }
  } finally {
    process.env.TZ = original
  }
})
test("invalid calendar dates and missing DST hours are rejected", () => {
  assert.throws(() =>
    parseDateTimeLocalInTimeZone("2026-02-31T10:00", "Asia/Seoul")
  )
  assert.throws(() =>
    parseDateTimeLocalInTimeZone("2026-03-08T02:30", "America/New_York")
  )
})
test("old quiz/exam queries and hashes converge to unified assessments", () => {
  for (const view of ["quizzes", "exams"]) {
    assert.equal(
      resolveInstructorClassSelection("assessments", view).section,
      "quizzes"
    )
    assert.equal(instructorSelectionForHash(`#${view}`)?.section, "quizzes")
  }
  assert.equal(
    resolveInstructorClassSelection("assessments", "assignments").section,
    "assignments"
  )
})
test("PDF written response is required and foreign choice IDs are refused", () => {
  const questions = [
      { id: "essay", type: "ESSAY", options: [] },
      { id: "mc", type: "MULTIPLE_CHOICE", options: [{ id: "own" }] }
    ],
    form = new FormData()
  assert.equal(
    Object.keys(validateAssessmentAnswers(questions, form)).length,
    2
  )
  form.set("answer_essay", "1. Written response")
  form.set("answer_mc", "foreign")
  assert.deepEqual(validateAssessmentAnswers(questions, form), {
    answer_mc: "Select an answer from this question."
  })
  form.set("answer_mc", "own")
  assert.deepEqual(validateAssessmentAnswers(questions, form), {})
})

import { getQuizAttemptStatus } from "../src/modules/quizzes/status"
test("written PDF responses remain awaiting grading in serialized panels",()=>{
 assert.equal(getQuizAttemptStatus({submittedAt:"2026-10-04",score:"0",answers:[{questionType:"ESSAY",score:null}]}),"Needs manual grading")
 assert.equal(getQuizAttemptStatus({submittedAt:"2026-10-04",score:"87",answers:[{questionType:"ESSAY",score:"87"}]}),"Graded")
})
