import assert from "node:assert/strict"

import { UserRole } from "@prisma/client"

import { canAccessAdminScope } from "../src/modules/admin/scope-rules"

const orgA = "org-a"
const orgB = "org-b"
const campusA = "campus-a"
const campusB = "campus-b"

assert.equal(
  canAccessAdminScope(
    [{ role: UserRole.SUPER_ADMIN, organizationId: orgA, campusId: null }],
    { organizationId: orgB, campusId: campusB }
  ),
  true,
  "SUPER_ADMIN should access every organization and campus"
)

assert.equal(
  canAccessAdminScope(
    [{ role: UserRole.SCHOOL_ADMIN, organizationId: orgA, campusId: campusA }],
    { organizationId: orgA, campusId: campusA }
  ),
  true,
  "SCHOOL_ADMIN should access their assigned campus"
)

assert.equal(
  canAccessAdminScope(
    [{ role: UserRole.SCHOOL_ADMIN, organizationId: orgA, campusId: campusA }],
    { organizationId: orgA, campusId: campusB }
  ),
  false,
  "SCHOOL_ADMIN should not access another campus"
)

assert.equal(
  canAccessAdminScope(
    [{ role: UserRole.ORG_ADMIN, organizationId: orgA, campusId: null }],
    { organizationId: orgA, campusId: campusB }
  ),
  true,
  "ORG_ADMIN should access campuses in their organization"
)

assert.equal(
  canAccessAdminScope(
    [{ role: UserRole.ORG_ADMIN, organizationId: orgA, campusId: null }],
    { organizationId: orgB, campusId: campusB }
  ),
  false,
  "ORG_ADMIN should not access another organization"
)

console.log("Admin scope checks passed.")
