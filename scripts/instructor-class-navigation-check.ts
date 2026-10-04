import assert from "node:assert/strict"
import { test } from "node:test"
import {
  instructorClassHref,
  instructorSelectionForHash,
  resolveInstructorClassSelection,
} from "../src/modules/dashboards/instructor-class-navigation"

test("class entry defaults to lessons, including invalid or repeated tab values", () => {
  for (const value of [undefined, "unknown", ["grades", "lessons"]]) {
    assert.deepEqual(resolveInstructorClassSelection(value, "quizzes"), { tab: "lessons", section: "lessons" })
  }
})

test("attendance and assessment menus select only their own valid views", () => {
  assert.equal(resolveInstructorClassSelection("attendance").section, "attendance")
  assert.equal(resolveInstructorClassSelection("attendance", "sessions").section, "sessions")
  assert.equal(resolveInstructorClassSelection("attendance", "quizzes").section, "attendance")
  for (const view of [undefined, "unknown", ["quizzes", "exams"]]) {
    assert.equal(resolveInstructorClassSelection("assessments", view).section, "assignments")
  }
  for (const view of ["assignments", "quizzes", "exams"]) {
    assert.equal(resolveInstructorClassSelection("assessments", view).section, view === "exams" ? "quizzes" : view)
  }
  assert.deepEqual(resolveInstructorClassSelection("grades", "sessions"), { tab: "grades", section: "grades" })
})

test("all existing section anchors open their corresponding menu", () => {
  for (const section of ["lessons", "attendance", "sessions", "assignments", "quizzes", "exams", "grades", "boards"]) {
    assert.equal(instructorSelectionForHash(`#${section}`)?.section, section === "exams" ? "quizzes" : section)
  }
  assert.equal(instructorSelectionForHash("#lesson-progress")?.section, "lessons")
  assert.equal(instructorSelectionForHash("#unknown"), null)
})

test("menu URLs round trip for refresh, sharing and browser history", () => {
  for (const hash of ["#lessons", "#attendance", "#sessions", "#assignments", "#quizzes", "#exams", "#grades", "#boards"]) {
    const selection = instructorSelectionForHash(hash)!
    const url = new URL(instructorClassHref("class-1", selection), "https://example.test")
    assert.deepEqual(resolveInstructorClassSelection(url.searchParams.get("tab")!, url.searchParams.get("view") ?? undefined), selection)
  }
})

test("lesson progress links preserve lessonId only in Lessons and encode URL data", () => {
  const lessonUrl = new URL(instructorClassHref("class/1", resolveInstructorClassSelection(), "lesson&2"), "https://example.test")
  assert.equal(lessonUrl.pathname, "/instructor/classes/class%2F1")
  assert.equal(lessonUrl.searchParams.get("lessonId"), "lesson&2")
  assert.equal(new URL(instructorClassHref("class-1", resolveInstructorClassSelection("boards"), "lesson-1"), "https://example.test").searchParams.has("lessonId"), false)
})
