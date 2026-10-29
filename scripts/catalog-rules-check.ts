import test from "node:test"
import assert from "node:assert/strict"
import { availableForRequest, canPublishNotice, canReview, reviewScope } from "../src/modules/catalog/rules"
const school = { role: "SCHOOL_ADMIN", organizationId: "school-a", campusId: "campus-a" }
test("approval belongs to the destination school and exact campus; staff and instructors are excluded", () => {
  assert.equal(canReview([school], { organizationId: "school-a", campusId: "campus-a" }), true)
  assert.equal(canReview([school], { organizationId: "school-b", campusId: "campus-a" }), false)
  assert.equal(canReview([school], { organizationId: "school-a", campusId: "campus-b" }), false)
  assert.equal(canReview([school], { organizationId: "school-a", campusId: null }), false)
  for (const role of ["ACADEMIC_STAFF", "INSTRUCTOR", "STUDENT", "PARENT"]) assert.equal(canReview([{ ...school, role }], { organizationId: "school-a", campusId: "campus-a" }), false)
  assert.equal(canReview([{ ...school, role: "SUPER_ADMIN" }], { organizationId: "school-b", campusId: null }), true)
  assert.deepEqual(reviewScope([{ ...school, role: "ACADEMIC_STAFF" }]), { OR: [] })
})
test("login notices require organization ownership or super admin", () => {
  assert.equal(canPublishNotice([school], "school-a"), true)
  assert.equal(canPublishNotice([school], "school-b"), false)
  assert.equal(canPublishNotice([{ ...school, role: "ACADEMIC_STAFF" }], "school-a"), false)
})
test("recruitment defaults to hidden and ended/inactive classes cannot be requested", () => {
  const now = new Date("2026-10-29T00:00:00Z")
  const section = { isRecruiting: true, endsAt: null as Date | null, organization: { isActive: true } }
  assert.equal(availableForRequest(section, now), true)
  assert.equal(availableForRequest({ ...section, isRecruiting: false }, now), false)
  assert.equal(availableForRequest({ ...section, organization: { isActive: false } }, now), false)
  assert.equal(availableForRequest({ ...section, endsAt: now }, now), false)
})
