import assert from "node:assert/strict"
import { test } from "node:test"
import { groupStudentTasks, type StudentTask } from "../src/modules/dashboards/student-tasks"
import { assessmentAvailability } from "../src/modules/quizzes/availability"

const now = new Date("2026-10-03T15:30:00Z") // Oct 4, 00:30 at school.
function task(id: string, due: string | null, changes: Partial<StudentTask> = {}): StudentTask {
  return { id, title: id, className: "Demo", href: "/student", dueAt: due ? new Date(due) : null, timeZone: "Asia/Seoul", submitted: false, status: "Available", kind: "Assignment", ...changes }
}
test("today follows the school calendar, and overdue items remain visible as closed", () => {
  const groups = groupStudentTasks([
    task("today", "2026-10-04T14:00:00Z"),
    task("closed", "2026-10-03T15:00:00Z", { status: "Closed" }),
    task("seven", "2026-10-11T14:00:00Z"),
    task("eight", "2026-10-12T14:00:00Z"),
    task("undated", null),
    task("completed", "2026-10-04T14:00:00Z", { submitted: true, status: "Maximum attempts reached" }),
    task("retake", "2026-10-04T13:00:00Z", { submitted: true }),
  ], now)
  assert.deepEqual(groups.today.map((item) => item.id), ["retake", "today"])
  assert.deepEqual(groups.soon.map((item) => item.id), ["seven"])
  assert.deepEqual(groups.overdue.map((item) => item.id), ["closed"])
  assert.deepEqual(groups.undated.map((item) => item.id), ["undated"])
})
test("seven school calendar days include the daylight saving transition", () => {
  const groups = groupStudentTasks([task("DST", "2026-11-08T04:30:00Z", { timeZone: "America/New_York" })], new Date("2026-10-31T16:00:00Z"))
  assert.equal(groups.soon[0]?.id, "DST") // Nov 7, 23:30; >168 elapsed hours.
})
test("assessment availability preserves publication, schedule and attempt gates", () => {
  const quiz = { isPublished: true, opensAt: null, closesAt: null, maxAttempts: 2 }
  assert.equal(assessmentAvailability({ ...quiz, isPublished: false }, 0, 1, now), "Unavailable")
  assert.equal(assessmentAvailability(quiz, 0, 0, now), "Unavailable")
  assert.equal(assessmentAvailability({ ...quiz, archivedAt: now }, 0, 1, now), "Unavailable")
  assert.equal(assessmentAvailability({ ...quiz, opensAt: new Date(now.getTime() + 1) }, 0, 1, now), "Not open yet")
  assert.equal(assessmentAvailability({ ...quiz, closesAt: new Date(now.getTime() - 1) }, 0, 1, now), "Closed")
  assert.equal(assessmentAvailability(quiz, 2, 1, now), "Maximum attempts reached")
  assert.equal(assessmentAvailability(quiz, 1, 1, now), "Available")
  assert.equal(assessmentAvailability({ ...quiz, closesAt: now }, 1, 1, now), "Available")
})
