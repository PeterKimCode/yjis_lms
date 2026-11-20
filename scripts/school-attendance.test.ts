import assert from "node:assert/strict"
import test from "node:test"
import { dateTimeLocalInTimeZone, formatDateTimeInTimeZone, parseDateTimeLocalInTimeZone } from "../src/lib/timezone"
import { arrivalStatus, minuteLabel, parseMinute, schoolPhase, schoolScopeKey, schoolTime } from "../src/modules/attendance/school-rules"

const timeZone = "Asia/Seoul"
const timeAt = (value: string) => schoolTime(new Date(value), timeZone)
const schedule = { opensMinute: 420, lateMinute: 480, closesMinute: 540, weekdays: [1, 2, 3, 4, 5], closedDates: ["2026-11-23"] }

test("daily attendance is based on the school date at midnight and on its operating days", () => {
  assert.deepEqual(timeAt("2026-11-20T15:00:00Z"), { date: "2026-11-21", minute: 0, weekday: 6 })
  assert.equal(schoolPhase(schedule, timeAt("2026-11-20T22:30:00Z")), "closed-day")
  assert.equal(schoolPhase(schedule, timeAt("2026-11-22T22:30:00Z")), "closed-day")
  assert.equal(schoolPhase(null, timeAt("2026-11-19T22:30:00Z")), "setup")
})

test("school QR opens at the configured time, and the end starts review", () => {
  assert.equal(schoolPhase(schedule, timeAt("2026-11-19T21:59:59Z")), "before")
  assert.equal(schoolPhase(schedule, timeAt("2026-11-19T22:00:00Z")), "open")
  assert.equal(arrivalStatus(schedule, timeAt("2026-11-19T22:59:59Z").minute), "PRESENT")
  assert.equal(arrivalStatus(schedule, timeAt("2026-11-19T23:00:00Z").minute), "LATE")
  assert.equal(schoolPhase(schedule, timeAt("2026-11-20T00:00:00Z")), "review")
})

test("schedule input accepts only valid 24-hour times and campus schedules have their own keys", () => {
  assert.equal(parseMinute("08:05"), 485)
  assert.equal(minuteLabel(485), "08:05")
  assert.equal(parseMinute("24:00"), null)
  assert.equal(parseMinute("10:60"), null)
  assert.equal(schoolScopeKey("abc", null), "school:abc")
  assert.equal(schoolScopeKey("abc", "abc"), "campus:abc")
})

test("class attendance uses the school's local clock for input and date rollover on display", () => {
  const session = parseDateTimeLocalInTimeZone("2026-11-20T17:30", "Asia/Seoul")
  assert.equal(session?.toISOString(), "2026-11-20T08:30:00.000Z")
  assert.equal(dateTimeLocalInTimeZone(session, "Asia/Manila"), "2026-11-20T16:30")
  const legacyTime = new Date("2026-06-05T17:27:00Z")
  assert.equal(formatDateTimeInTimeZone(legacyTime, "Asia/Seoul"), "Jun 6, 2026, 2:27 AM")
})
