"use server"

import { revalidatePath } from "next/cache"
import { UserRole, type Prisma } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { requireAnyRole } from "@/modules/auth/permissions"
import { availableForRequest, canReview } from "./rules"

class CatalogError extends Error {}
export type CatalogState = { ok: boolean; message: string }
const refresh = () => { for (const p of ["/student", "/parent", "/admin", "/instructor", "/messages"]) revalidatePath(p, "layout") }
async function lock(tx: Prisma.TransactionClient, classSectionId: string) {
  await tx.$queryRaw`SELECT "id" FROM "ClassSection" WHERE "id" = ${classSectionId} FOR UPDATE`
}
async function audit(tx: Prisma.TransactionClient, actorUserId: string, section: { id: string; organizationId: string; campusId: string | null }, action: string, entityId: string) {
  await tx.auditLog.create({ data: { actorUserId, organizationId: section.organizationId, campusId: section.campusId, entityType: action.startsWith("class.") ? "ClassSection" : "EnrollmentRequest", entityId, action } })
}
async function notify(tx: Prisma.TransactionClient, userId: string, title: string, actionUrl: string, body?: string) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { organizationId: true } })
  await tx.notification.create({ data: { userId, organizationId: user.organizationId, type: "SYSTEM_NOTICE", title, actionUrl, body } })
}

export async function requestEnrollment(_: CatalogState, form: FormData): Promise<CatalogState> {
  const user = await requireAnyRole([UserRole.STUDENT])
  try {
    const classSectionId = String(form.get("classSectionId") ?? "")
    await getPrismaClient().$transaction(async tx => {
      await lock(tx, classSectionId)
      const section = await tx.classSection.findUniqueOrThrow({ where: { id: classSectionId }, include: { organization: { select: { isActive: true } } } })
      if (!availableForRequest(section)) throw new CatalogError("This class is not accepting applications.")
      const enrollment = await tx.enrollment.findUnique({ where: { classSectionId_studentId: { classSectionId, studentId: user.id } } })
      if (enrollment && ["ENROLLED", "COMPLETED"].includes(enrollment.status)) throw new CatalogError("You are already enrolled or have completed this class.")
      const previous = await tx.enrollmentRequest.findUnique({ where: { classSectionId_studentId: { classSectionId, studentId: user.id } } })
      if (previous?.status === "PENDING") throw new CatalogError("An application is already pending.")
      const request = await tx.enrollmentRequest.upsert({ where: { classSectionId_studentId: { classSectionId, studentId: user.id } }, create: { classSectionId, studentId: user.id }, update: { status: "PENDING", reviewedById: null, reviewedAt: null, rejectionReason: null, createdAt: new Date() } })
      await audit(tx, user.id, section, "enrollment.request", request.id)
      const now = new Date()
      const reviewers = await tx.user.findMany({ where: { isActive: true, roleAssignments: { some: { AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }], OR: [{ role: "SUPER_ADMIN" }, { role: "SCHOOL_ADMIN", organizationId: section.organizationId, OR: [{ campusId: null }, { campusId: section.campusId }] }] } } }, select: { id: true } })
      for (const reviewer of reviewers) await notify(tx, reviewer.id, `Enrollment request: ${section.name}`, "/admin/enrollment-requests", `${user.name} requested enrollment.`)
    })
    refresh(); return { ok: true, message: "Application sent. Please wait for approval." }
  } catch (e) { return { ok: false, message: e instanceof CatalogError ? e.message : "Application failed. Please try again." } }
}

export async function cancelEnrollmentRequest(_: CatalogState, form: FormData): Promise<CatalogState> {
  const user = await requireAnyRole([UserRole.STUDENT])
  try {
    await getPrismaClient().$transaction(async tx => {
      const id = String(form.get("requestId") ?? "")
      const request = await tx.enrollmentRequest.findUniqueOrThrow({ where: { id }, include: { classSection: true } })
      await lock(tx, request.classSectionId)
      const changed = await tx.enrollmentRequest.updateMany({ where: { id, studentId: user.id, status: "PENDING" }, data: { status: "CANCELLED" } })
      if (!changed.count) throw new CatalogError("Only your pending application can be cancelled. Refresh to see its status.")
      await audit(tx, user.id, request.classSection, "enrollment.cancel", id)
    })
    refresh(); return { ok: true, message: "Application cancelled." }
  } catch (e) { return { ok: false, message: e instanceof CatalogError ? e.message : "Cancellation failed." } }
}

export async function reviewEnrollmentRequest(_: CatalogState, form: FormData): Promise<CatalogState> {
  const user = await requireAnyRole([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN])
  try {
    const decision = String(form.get("decision")), reason = String(form.get("reason") ?? "").trim()
    if (!["APPROVED", "REJECTED"].includes(decision)) throw new CatalogError("Invalid decision.")
    if (decision === "REJECTED" && (!reason || reason.length > 1000)) throw new CatalogError("Enter a rejection reason (1–1000 characters).")
    await getPrismaClient().$transaction(async tx => {
      const id = String(form.get("requestId") ?? "")
      const initial = await tx.enrollmentRequest.findUniqueOrThrow({ where: { id }, select: { classSectionId: true } })
      await lock(tx, initial.classSectionId)
      const request = await tx.enrollmentRequest.findUniqueOrThrow({ where: { id }, include: { classSection: { include: { organization: { select: { isActive: true } } } }, student: { select: { isActive: true } } } })
      const section = request.classSection
      if (!canReview(user.roleAssignments, section)) throw new CatalogError("You cannot review applications for this class.")
      if (request.status !== "PENDING") throw new CatalogError("This application has already been processed.")
      if (decision === "APPROVED") {
        if (!section.organization.isActive || !request.student.isActive || section.endsAt && section.endsAt <= new Date()) throw new CatalogError("The student or class is no longer active.")
        const key = { classSectionId: section.id, studentId: request.studentId }
        const existing = await tx.enrollment.findUnique({ where: { classSectionId_studentId: key } })
        if (existing?.status === "COMPLETED") throw new CatalogError("The student has already completed this class.")
        if (existing?.status !== "ENROLLED" && section.capacity !== null && await tx.enrollment.count({ where: { classSectionId: section.id, status: "ENROLLED" } }) >= section.capacity) throw new CatalogError("This class is full.")
        await tx.enrollment.upsert({ where: { classSectionId_studentId: key }, create: { ...key, organizationId: section.organizationId, campusId: section.campusId }, update: { status: "ENROLLED", enrolledAt: new Date(), completedAt: null, droppedAt: null } })
      }
      await tx.enrollmentRequest.update({ where: { id }, data: { status: decision as "APPROVED" | "REJECTED", reviewedById: user.id, reviewedAt: new Date(), rejectionReason: decision === "REJECTED" ? reason : null } })
      await audit(tx, user.id, section, `enrollment.${decision.toLowerCase()}`, id)
      await notify(tx, request.studentId, `${section.name}: ${decision === "APPROVED" ? "approved" : "not approved"}`, decision === "APPROVED" ? `/student/classes/${section.id}` : "/student/catalog?status=REJECTED", decision === "REJECTED" ? reason : "You can now open this class.")
    })
    refresh(); return { ok: true, message: "Decision saved." }
  } catch (e) { return { ok: false, message: e instanceof CatalogError ? e.message : "Could not save the decision." } }
}

export async function saveRecruitment(_: CatalogState, form: FormData): Promise<CatalogState> {
  const user = await requireAnyRole([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN])
  try {
    const id = String(form.get("classSectionId") ?? ""), description = String(form.get("catalogDescription") ?? "").trim()
    if (description.length > 5000) throw new CatalogError("Introduction must be 5000 characters or less.")
    await getPrismaClient().$transaction(async tx => {
      await lock(tx, id)
      const section = await tx.classSection.findUniqueOrThrow({ where: { id } })
      if (!canReview(user.roleAssignments, section)) throw new CatalogError("You cannot manage recruitment for this class.")
      await tx.classSection.update({ where: { id }, data: { isRecruiting: form.get("isRecruiting") === "on", catalogDescription: description || null } })
      await audit(tx, user.id, section, "class.recruitment.update", id)
    })
    refresh(); return { ok: true, message: "Recruitment settings saved." }
  } catch (e) { return { ok: false, message: e instanceof CatalogError ? e.message : "Could not save recruitment." } }
}
