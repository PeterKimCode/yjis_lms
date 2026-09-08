"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import { getClassSectionWhereForAdmin, getUserWhereForAdmin, requireAdmin } from "./access"

const requestSchema = z.object({
  userId: z.string().min(1),
  mode: z.enum(["student", "instructor"]),
  sectionId: z.string().optional(),
  selectedIds: z.array(z.string().min(1)).min(1).max(100),
})

class EnrollmentInputError extends Error {}

export async function enrollFromUserPage(input: z.input<typeof requestSchema>) {
  const admin = await requireAdmin()
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Select between 1 and 100 items." }
  const data = parsed.data
  const selected = [...new Set(data.selectedIds)]
  const db = getPrismaClient()
  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { AND: [getUserWhereForAdmin(admin), { id: data.userId, roleAssignments: { some: { role: data.mode === "student" ? "STUDENT" : "INSTRUCTOR" } } }] },
      })
      if (!user) throw new EnrollmentInputError("User is not available in your admin scope.")
      const sectionIds = data.mode === "student" ? selected : [data.sectionId ?? ""]
      const sections = await tx.classSection.findMany({
        where: { AND: [getClassSectionWhereForAdmin(admin), {
          id: { in: sectionIds }, organizationId: user.organizationId,
          ...(data.mode === "instructor" ? { instructors: { some: { instructorId: user.id } } } : {}),
        }] },
      })
      if (sections.length !== sectionIds.length) throw new EnrollmentInputError("Selected classes must belong to this organization and admin scope.")
      const studentIds = data.mode === "student" ? [user.id] : selected
      const students = await tx.user.findMany({
        where: { AND: [getUserWhereForAdmin(admin), { id: { in: studentIds }, isActive: true, organizationId: user.organizationId, roleAssignments: { some: { role: "STUDENT" } } }] },
        select: { id: true },
      })
      if (students.length !== studentIds.length) throw new EnrollmentInputError("Select active students from the same organization and your admin scope.")
      let changed = 0
      for (const section of sections) {
        const existing = await tx.enrollment.findMany({ where: { classSectionId: section.id }, select: { studentId: true, status: true } })
        const status = new Map(existing.map((enrollment) => [enrollment.studentId, enrollment.status]))
        const additions = students.filter((student) => status.get(student.id) !== "ENROLLED")
        if (additions.some((student) => status.has(student.id))) throw new EnrollmentInputError("An existing enrollment has another status. Change its status from Class Sections to preserve its academic record.")
        const count = existing.filter((enrollment) => enrollment.status === "ENROLLED").length
        if (section.capacity !== null && count + additions.length > section.capacity) throw new EnrollmentInputError(`Class capacity exceeded: ${section.name}`)
        for (const student of additions) {
          await tx.enrollment.create({ data: { organizationId: section.organizationId, campusId: section.campusId, classSectionId: section.id, studentId: student.id, status: "ENROLLED" } })
          changed++
        }
      }
      return { changed, organizationId: user.organizationId, sectionIds, studentIds }
    }, { isolationLevel: "Serializable", timeout: 30000 })
    // Enrollment is committed; audit failures must not turn success into a retry.
    try {
      await writeAuditLog({ action: "class_section.student.enroll", actorUserId: admin.id, organizationId: result.organizationId, entityType: "User", entityId: data.userId, summary: `Enrolled ${result.changed} student/class selections from user details.`, metadata: { sectionIds: result.sectionIds, studentIds: result.studentIds } })
    } catch (error) { console.error("Enrollment audit failed", error) }
    revalidatePath("/admin/users", "layout")
    revalidatePath("/admin/class-sections", "layout")
    revalidatePath("/instructor", "layout")
    revalidatePath("/student", "layout")
    return { ok: true, message: result.changed ? `${result.changed} enrollment(s) saved.` : "Already enrolled. No changes needed." }
  } catch (error) {
    console.error("User enrollment failed", error)
    return { ok: false, message: error instanceof EnrollmentInputError ? error.message : "Could not enroll. Refresh the list and try again." }
  }
}
