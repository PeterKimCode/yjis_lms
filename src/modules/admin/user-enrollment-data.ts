import "server-only"

import type { Prisma } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { getClassSectionWhereForAdmin, getUserWhereForAdmin, requireAdmin } from "./access"

type Query = { page?: number; q?: string; tab?: string; sectionId?: string }
const pageSize = 25
const tabs = ["All", "Enrolled", "Not enrolled", "Other status"] as const

export async function getUserEnrollmentData(userId: string, query: Query = {}) {
  const admin = await requireAdmin()
  const db = getPrismaClient()
  const user = await db.user.findFirst({
    where: { AND: [getUserWhereForAdmin(admin), { id: userId }] },
    select: { id: true, isActive: true, organizationId: true, roleAssignments: { select: { role: true } } },
  })
  if (!user) return null
  const student = user.roleAssignments.some((role) => role.role === "STUDENT")
  if (!student && !user.roleAssignments.some((role) => role.role === "INSTRUCTOR")) return null
  const q = (query.q ?? "").trim().slice(0, 200)
  const tab = tabs.find((value) => value === query.tab) ?? "All"
  const scopedSections: Prisma.ClassSectionWhereInput = { AND: [
    getClassSectionWhereForAdmin(admin),
    { organizationId: user.organizationId, ...(!student ? { instructors: { some: { instructorId: user.id } } } : {}) },
  ] }
  // The instructor picker contains only class metadata, never every student's enrollment.
  const sectionOptions = student ? [] : await db.classSection.findMany({
    where: scopedSections, orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  })
  const sectionId = sectionOptions.find((item) => item.id === query.sectionId)?.id ?? sectionOptions[0]?.id ?? ""
  function enrollmentFilter(value: string): Prisma.EnrollmentListRelationFilter {
    const subject = student ? { studentId: user!.id } : { classSectionId: sectionId }
    if (value === "Not enrolled") return { none: subject }
    return { some: { ...subject, status: value === "Enrolled" ? "ENROLLED" : { not: "ENROLLED" } } }
  }
  const sectionWhere = (value: string): Prisma.ClassSectionWhereInput => ({ AND: [
    scopedSections,
    q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { sectionCode: { contains: q, mode: "insensitive" } },
      { course: { title: { contains: q, mode: "insensitive" } } },
      { campus: { name: { contains: q, mode: "insensitive" } } },
      { instructors: { some: { instructor: { name: { contains: q, mode: "insensitive" } } } } },
    ] } : {},
    value === "All" ? {} : { enrollments: enrollmentFilter(value) },
  ] })
  const studentWhere = (value: string): Prisma.UserWhereInput => ({ AND: [
    getUserWhereForAdmin(admin),
    { organizationId: user!.organizationId, roleAssignments: { some: { role: "STUDENT" } } },
    sectionId ? {} : { id: { in: [] } },
    q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    value === "All" ? {} : { enrollments: enrollmentFilter(value) },
  ] })
  const counts = await Promise.all(tabs.map((value) => student
    ? db.classSection.count({ where: sectionWhere(value) })
    : db.user.count({ where: studentWhere(value) })))
  const tabCounts = Object.fromEntries(tabs.map((value, index) => [value, counts[index]]))
  const total = tabCounts[tab]
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const requestedPage = Number.isSafeInteger(query.page) ? query.page! : 1
  const page = Math.max(1, Math.min(pageCount, requestedPage))
  const students = student ? [] : await db.user.findMany({
    where: studentWhere(tab), skip: (page - 1) * pageSize, take: pageSize,
    select: { id: true, name: true, email: true, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })
  const sections = await db.classSection.findMany({
    where: student ? sectionWhere(tab) : { AND: [scopedSections, { id: sectionId }] },
    ...(student ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true, name: true, sectionCode: true, capacity: true,
      course: { select: { title: true } }, campus: { select: { name: true } },
      term: { select: { name: true } }, gradeLevel: { select: { name: true } },
      instructors: { select: { instructor: { select: { name: true } } } },
      enrollments: { where: { studentId: student ? user.id : { in: students.map((item) => item.id) } }, select: { studentId: true, status: true } },
      _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
    },
  })
  return {
    mode: student ? "student" as const : "instructor" as const,
    page, pageCount, total, tabCounts, tab, q, sectionId, sectionOptions, subjectActive: user.isActive,
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
