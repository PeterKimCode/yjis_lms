import assert from "node:assert/strict"
import test from "node:test"
import { AttendanceStatus } from "@prisma/client"
import { isQrOpen, issueReview, issueTicket, readReview, suggestedStatus, ticketHash } from "../src/modules/attendance/smart-rules"
import { qrPrefix } from "../src/modules/attendance/smart-shared"

const secret = "test-key"

test("students and sessions get different opaque QR codes that rotate every 12 seconds", () => {
  const first = issueTicket(secret, "meeting-123", "student-456", 120_000)
  assert.match(first.code.slice(qrPrefix.length), /^[A-Za-z0-9_-]{43}$/)
  assert.ok(!first.code.includes("meeting-123"))
  assert.ok(!first.code.includes("student-456"))
  assert.equal(first.expiresAt, 132_000)
  assert.deepEqual(issueTicket(secret, "meeting-123", "student-456", 131_999), first)
  assert.notEqual(issueTicket(secret, "meeting-123", "student-456", 132_000).code, first.code)
  assert.notEqual(issueTicket(secret, "meeting-123", "student-789", 120_000).code, first.code)
  assert.notEqual(issueTicket(secret, "meeting-000", "student-456", 120_000).code, first.code)
  assert.match(ticketHash(first.code) ?? "", /^[a-f0-9]{64}$/)
  assert.equal(ticketHash("https://example.org/qr"), null)
})

test("identity confirmation receipt expires and is scoped to the scanner, student, and session", () => {
  const receipt = issueReview(secret, "session", "student", "teacher", 1_000)
  assert.deepEqual(readReview(secret, receipt, "session", "student", "teacher", 45_999), new Date(1_000))
  assert.equal(readReview(secret, receipt, "session", "student", "teacher", 46_000), null)
  assert.equal(readReview(secret, receipt, "session", "student", "teacher", 999), null)
  assert.equal(readReview(secret, receipt, "session", "student", "other-teacher", 2_000), null)
  assert.equal(readReview(secret, receipt, "session", "other-student", "teacher", 2_000), null)
  assert.equal(readReview(secret, receipt, "other-session", "student", "teacher", 2_000), null)
  assert.equal(readReview(secret, receipt + ".", "session", "student", "teacher", 2_000), null)
})

test("check-in window rejects future, expired and finalized sessions", () => {
  const session = { qrOpenedAt: new Date(1_000), qrClosesAt: new Date(2_000), qrFinalizedAt: null }
  assert.equal(isQrOpen(session, new Date(999)), false)
  assert.equal(isQrOpen(session, new Date(1_000)), true)
  assert.equal(isQrOpen(session, new Date(2_000)), false)
  assert.equal(isQrOpen({ ...session, qrFinalizedAt: new Date(1_500) }, new Date(1_501)), false)
})

test("attendance suggestions distinguish on-time, late and unverified students", () => {
  const lateAt = new Date(2_000)
  assert.equal(suggestedStatus(new Date(1_999), lateAt), AttendanceStatus.PRESENT)
  assert.equal(suggestedStatus(new Date(2_000), lateAt), AttendanceStatus.LATE)
  assert.equal(suggestedStatus(null, lateAt), AttendanceStatus.ABSENT)
  assert.equal(suggestedStatus(new Date(3_000), null), AttendanceStatus.PRESENT)
})
