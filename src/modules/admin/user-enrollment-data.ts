import "server-only"

import { getPrismaClient } from "@/lib/prisma"
import { getClassSectionWhereForAdmin, getUserWhereForAdmin, requireAdmin } from "./access"

export async function getUserEnrollmentData(userId: string) {
  const admin = await requireAdmin()
  const db = getPrismaClient()
  const user = await db.user.findFirst({
    where: { AND: [getUserWhereForAdmin(admin), { id: userId }] },
    select: { id: true, organizationId: true, roleAssignments: { select: { role: true } } },
  })
  if (!user) return null
  const student = user.roleAssignments.some((role) => role.role === "STUDENT")
  const instructor = user.roleAssignments.some((role) => role.role === "INSTRUCTOR")
  if (!student && !instructor) return null
  const sections = await db.classSection.findMany({
    where: { AND: [getClassSectionWhereForAdmin(admin), {
      organizationId: user.organizationId,
      ...(!student ? { instructors: { some: { instructorId: user.id } } } : {}),
    }] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true, name: true, sectionCode: true, capacity: true,
      course: { select: { title: true } }, campus: { select: { name: true } },
      term: { select: { name: true } }, gradeLevel: { select: { name: true } },
      instructors: { select: { instructor: { select: { name: true } } } },
      enrollments: { where: student ? { studentId: user.id } : { student: { AND: [getUserWhereForAdmin(admin), { organizationId: user.organizationId }] } }, select: { studentId: true, status: true } },
      _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
    },
  })
  const students = student ? [] : await db.user.findMany({
    where: { AND: [getUserWhereForAdmin(admin), { organizationId: user.organizationId, roleAssignments: { some: { role: "STUDENT" } } }] },
    select: { id: true, name: true, email: true, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })
  return {
    mode: student ? "student" as const : "instructor" as const,
    sections: sections.map((section) => ({
      id: section.id, name: section.name, code: section.sectionCode ?? "-",
      course: section.course.title, campus: section.campus?.name ?? "Organization-wide",
      term: section.term?.name ?? "-", grade: section.gradeLevel?.name ?? "-",
      teachers: section.instructors.map((assignment) => assignment.instructor.name).join(", ") || "Unassigned",
      capacity: section.capacity, enrolled: section._count.enrollments,
      enrollments: section.enrollments,
    })),
    students,
  }
}
