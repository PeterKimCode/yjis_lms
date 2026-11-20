"use server"

import { AttendanceStatus, DeliveryMode, NotificationChannel, NotificationType, Prisma, UserRole } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import { getCurrentUser } from "@/modules/auth/permissions"
import { resolvePolicies } from "@/modules/policies/resolve"
import { activeAttendanceEnrollment, getSmartAttendanceManager } from "./smart-data"
import { isQrOpen, issueReview, issueTicket, qrSecret, readReview, suggestedStatus, ticketHash } from "./smart-rules"
import { attendanceLabels, qrWindowMinutes } from "./smart-shared"

const id = z.string().min(1).max(80)
const qrTarget = z.object({ classSessionId: id, studentId: id, receipt: z.string().max(80) })
const rosterEdit = z.object({
  classSessionId: id,
  studentId: id,
  status: z.enum(AttendanceStatus).exclude(["PENDING"]).nullable(),
  note: z.string().trim().max(500),
})

async function getManagerSession(classSessionId: string) {
  if (!id.safeParse(classSessionId).success) return null
  const meeting = await getPrismaClient().classSession.findUnique({
    where: { id: classSessionId },
    select: {
      id: true, organizationId: true, campusId: true, classSectionId: true, deliveryMode: true,
      title: true, startsAt: true, attendanceSession: true,
    },
  })
  if (!meeting) return null
  const actor = await getSmartAttendanceManager(meeting.classSectionId)
  return actor ? { meeting, actor } : null
}

async function getLockedSession(tx: Prisma.TransactionClient, attendanceSessionId: string) {
  await tx.$queryRaw`SELECT id FROM "AttendanceSession" WHERE id = ${attendanceSessionId} FOR UPDATE`
  return tx.attendanceSession.findUnique({ where: { id: attendanceSessionId } })
}

function refreshAttendance(classSessionId: string, classSectionId: string) {
  revalidatePath(`/attendance/${classSessionId}`)
  revalidatePath("/admin/attendance")
  revalidatePath(`/instructor/classes/${classSectionId}`)
  revalidatePath(`/student/classes/${classSectionId}`)
  revalidatePath("/student/attendance")
  revalidatePath("/notifications")
}

export async function openSmartAttendance(classSessionId: string, minutes: number) {
  if (!qrWindowMinutes.some((duration) => duration === minutes)) return { error: "Choose a QR window." }
  const context = await getManagerSession(classSessionId)
  if (!context) return { error: "You cannot manage attendance for this session." }
  if (!qrSecret()) return { error: "The server's QR signing key is unavailable." }
  const { meeting, actor } = context
  if (meeting.attendanceSession || meeting.deliveryMode === DeliveryMode.ONLINE) {
    return { error: "QR attendance requires an in-person session with no attendance sheet yet." }
  }
  const scope = { organizationId: meeting.organizationId, campusId: meeting.campusId, classSectionId: meeting.classSectionId }
  const { attendance } = await resolvePolicies(scope)
  const prisma = getPrismaClient()
  const enrollments = await prisma.enrollment.findMany({
    where: activeAttendanceEnrollment(meeting.classSectionId), select: { studentId: true },
  })
  if (!enrollments.length) return { error: "There are no active students in this class." }
  const now = new Date()
  let session
  try {
    session = await prisma.attendanceSession.create({
      data: {
        ...scope,
        classSessionId,
        title: meeting.title ?? "Attendance",
        takenAt: meeting.startsAt,
        qrOpenedAt: now,
        qrClosesAt: new Date(now.getTime() + minutes * 60_000),
        qrLateAt: attendance.lateThresholdMinutes === null ? null :
          new Date(meeting.startsAt.getTime() + attendance.lateThresholdMinutes * 60_000),
        qrCheckIns: { createMany: { data: enrollments } },
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An attendance sheet already exists. Refresh to see it." }
    }
    throw error
  }
  await writeAuditLog({
    ...scope, actorUserId: actor.id, action: "attendance.qr.open", entityType: "AttendanceSession", entityId: session.id,
  })
  refreshAttendance(classSessionId, meeting.classSectionId)
  return { ok: true }
}

export async function getStudentAttendanceQr(attendanceSessionId: string) {
  if (!id.safeParse(attendanceSessionId).success) return { error: "No QR session is available." }
  const actor = await getCurrentUser()
  if (!actor?.roleAssignments.some(({ role }) => role === UserRole.STUDENT)) {
    return { error: "Sign in with your student account to show your QR." }
  }
  const secret = qrSecret()
  if (!secret) return { error: "QR attendance is temporarily unavailable." }
  const prisma = getPrismaClient()
  const where = { attendanceSessionId_studentId: { attendanceSessionId, studentId: actor.id } }
  const row = await prisma.smartAttendanceCheckIn.findUnique({ where, include: { attendanceSession: true } })
  if (!row || !await prisma.enrollment.findFirst({
    where: activeAttendanceEnrollment(row.attendanceSession.classSectionId, actor.id), select: { id: true },
  })) return { error: "No QR session is available." }
  if (row.verifiedAt) return { checkedIn: true }
  const now = new Date()
  if (!isQrOpen(row.attendanceSession, now)) return { error: "The QR check-in window has closed." }
  const ticket = issueTicket(secret, attendanceSessionId, actor.id, now.getTime())
  const expiresAt = new Date(Math.min(ticket.expiresAt, row.attendanceSession.qrClosesAt!.getTime()))
  if (row.ticketExpiresAt?.getTime() !== expiresAt.getTime()) {
    const result = await prisma.smartAttendanceCheckIn.updateMany({
      where: {
        ...where.attendanceSessionId_studentId, verifiedAt: null,
        OR: [{ ticketExpiresAt: null }, { ticketExpiresAt: { lte: expiresAt } }],
      },
      data: { ticketHash: ticketHash(ticket.code), ticketExpiresAt: expiresAt },
    })
    if (!result.count) return { retry: true }
  }
  return { code: ticket.code, validForMs: Math.max(0, expiresAt.getTime() - Date.now()) }
}

export async function inspectAttendanceQr(classSessionId: string, code: string) {
  const hash = typeof code === "string" && code.length < 80 ? ticketHash(code.trim()) : null
  if (!hash) return { error: "This is not an LMS attendance QR." }
  const context = await getManagerSession(classSessionId)
  const session = context?.meeting.attendanceSession
  const secret = qrSecret()
  const now = new Date()
  if (!context || !session || !secret || !isQrOpen(session, now)) {
    return { error: "There is no open QR window for this session." }
  }
  const prisma = getPrismaClient()
  const row = await prisma.smartAttendanceCheckIn.findUnique({
    where: { ticketHash: hash, attendanceSessionId: session.id, verifiedAt: null, ticketExpiresAt: { gt: now } },
    select: { studentId: true, student: { select: { name: true } } },
  })
  if (!row || !await prisma.enrollment.findFirst({
    where: activeAttendanceEnrollment(session.classSectionId, row.studentId), select: { id: true },
  })) return { error: "QR expired, already checked in, or belongs to a different session. Ask for the current QR." }
  return {
    studentId: row.studentId,
    studentName: row.student.name,
    receipt: issueReview(secret, session.id, row.studentId, context.actor.id, now.getTime()),
  }
}

export async function confirmAttendanceIdentity(input: z.input<typeof qrTarget>) {
  const parsed = qrTarget.safeParse(input)
  if (!parsed.success) return { error: "Scan the student's current QR again." }
  const { classSessionId, studentId, receipt } = parsed.data
  const context = await getManagerSession(classSessionId)
  const session = context?.meeting.attendanceSession
  const secret = qrSecret()
  if (!context || !session || !secret) return { error: "You cannot verify this check-in." }
  const result = await getPrismaClient().$transaction(async (tx) => {
    const current = await getLockedSession(tx, session.id)
    const now = new Date()
    if (!current || !isQrOpen(current, now)) return { error: "The QR check-in window has closed." }
    const scannedAt = readReview(secret, receipt, session.id, studentId, context.actor.id, now.getTime())
    if (!scannedAt) return { error: "The identity review expired. Scan the current QR again." }
    if (!await tx.enrollment.findFirst({
      where: activeAttendanceEnrollment(session.classSectionId, studentId), select: { id: true },
    })) return { error: "This student is no longer enrolled." }
    const verified = await tx.smartAttendanceCheckIn.updateMany({
      where: { attendanceSessionId: session.id, studentId, verifiedAt: null },
      data: { verifiedAt: scannedAt, verifiedById: context.actor.id, ticketHash: null, ticketExpiresAt: null },
    })
    return verified.count ? { ok: true } : { error: "This student has already checked in." }
  })
  if ("ok" in result) refreshAttendance(classSessionId, session.classSectionId)
  return result
}

export async function closeSmartAttendance(classSessionId: string) {
  const context = await getManagerSession(classSessionId)
  const session = context?.meeting.attendanceSession
  if (!session?.qrOpenedAt) return { error: "No QR attendance window is available." }
  const now = new Date()
  await getPrismaClient().attendanceSession.updateMany({
    where: { id: session.id, qrClosesAt: { gt: now }, qrFinalizedAt: null }, data: { qrClosesAt: now },
  })
  refreshAttendance(classSessionId, session.classSectionId)
  return { ok: true }
}

export async function publishSmartAttendance(classSessionId: string) {
  const context = await getManagerSession(classSessionId)
  const session = context?.meeting.attendanceSession
  if (!context || !session?.qrOpenedAt) return { error: "No QR attendance sheet is available." }
  const { actor } = context
  const result = await getPrismaClient().$transaction(async (tx) => {
    const current = await getLockedSession(tx, session.id)
    if (!current || current.qrFinalizedAt) return { error: "This attendance sheet has already been published." }
    const now = new Date()
    if (isQrOpen(current, now)) return { error: "Close check-in and review attendance before publishing." }
    const enrollments = await tx.enrollment.findMany({
      where: activeAttendanceEnrollment(session.classSectionId), select: { studentId: true },
    })
    const rows = await tx.smartAttendanceCheckIn.findMany({
      where: { attendanceSessionId: session.id, studentId: { in: enrollments.map(({ studentId }) => studentId) } },
    })
    if (!rows.length) return { error: "No active students are on this attendance sheet." }
    const records = await tx.attendanceRecord.createManyAndReturn({
      data: rows.map((row) => {
        const status = row.reviewStatus ?? suggestedStatus(row.verifiedAt, session.qrLateAt)
        return {
          organizationId: session.organizationId, campusId: session.campusId, attendanceSessionId: session.id,
          studentId: row.studentId, status, note: row.reviewNote,
          checkedInAt: checkInTime(status, row.verifiedAt, now),
          checkedOutAt: status === AttendanceStatus.EARLY_LEAVE ? now : null,
        }
      }),
      select: { id: true, status: true, studentId: true },
    })
    await tx.attendanceSession.update({ where: { id: session.id }, data: { qrFinalizedAt: now } })
    await tx.smartAttendanceCheckIn.updateMany({
      where: { attendanceSessionId: session.id, ticketHash: { not: null } },
      data: { ticketHash: null, ticketExpiresAt: null },
    })
    await notifyAttendance(tx, session, records, actor.id, false)
    return { ok: true, total: records.length }
  }, { timeout: 15_000 })
  if ("ok" in result) {
    await writeAuditLog({
      organizationId: session.organizationId, campusId: session.campusId, actorUserId: actor.id,
      action: "attendance.qr.publish", entityType: "AttendanceSession", entityId: session.id,
      metadata: { count: result.total },
    })
    refreshAttendance(classSessionId, session.classSectionId)
  }
  return result
}

export async function reviseSmartAttendance(input: z.input<typeof rosterEdit>) {
  const parsed = rosterEdit.safeParse(input)
  if (!parsed.success) return { error: "Choose a valid status and enter a note of up to 500 characters." }
  const { classSessionId, studentId, status, note } = parsed.data
  const context = await getManagerSession(classSessionId)
  const session = context?.meeting.attendanceSession
  if (!context || !session?.qrOpenedAt) return { error: "You cannot edit this attendance sheet." }
  const { attendance } = await resolvePolicies(session)
  if (!attendance.allowInstructorOverride) return { error: "School policy does not allow attendance overrides." }
  const result = await getPrismaClient().$transaction(async (tx) => {
    const current = await getLockedSession(tx, session.id)
    if (!current) return { error: "This attendance sheet is no longer available." }
    const where = { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId } }
    const row = await tx.smartAttendanceCheckIn.findUnique({ where })
    if (!row) return { error: "This student is not on the attendance sheet." }
    if (!row.verifiedAt && status && [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EARLY_LEAVE].some((value) => value === status) && !note) {
      return { error: "Enter a note explaining how you verified this student's attendance." }
    }
    if (current.qrFinalizedAt) {
      const record = await tx.attendanceRecord.findUnique({ where })
      if (!record || !status) return { error: "Choose a status for the published attendance record." }
      if (record.status !== status || record.note !== (note || null)) {
        const now = new Date()
        const saved = await tx.attendanceRecord.update({
          where,
          data: {
            status, note: note || null,
            checkedInAt: checkInTime(status, row.verifiedAt ?? record.checkedInAt, now),
            checkedOutAt: status === AttendanceStatus.EARLY_LEAVE ? record.checkedOutAt ?? now : null,
          },
          select: { id: true, status: true, studentId: true },
        })
        if (record.status !== status) await notifyAttendance(tx, session, [saved], context.actor.id, true)
      }
    }
    await tx.smartAttendanceCheckIn.update({ where, data: { reviewStatus: status, reviewNote: note || null } })
    return { ok: true }
  })
  if ("ok" in result) {
    await writeAuditLog({
      organizationId: session.organizationId, campusId: session.campusId, actorUserId: context.actor.id,
      action: "attendance.qr.revise", entityType: "AttendanceSession", entityId: session.id,
      metadata: { studentId, status },
    })
    refreshAttendance(classSessionId, session.classSectionId)
  }
  return result
}

function checkInTime(status: AttendanceStatus, verifiedAt: Date | null, now: Date) {
  return status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE || status === AttendanceStatus.EARLY_LEAVE
    ? verifiedAt ?? now : null
}

async function notifyAttendance(
  tx: Prisma.TransactionClient,
  session: { classSectionId: string; title: string | null },
  records: { id: string; studentId: string; status: AttendanceStatus }[],
  actorId: string,
  corrected: boolean
) {
  const type = NotificationType.ATTENDANCE_UPDATED
  const parentFilter = { isActive: true, id: { not: actorId } }
  const recipients = await tx.user.findMany({
    where: { id: { in: records.map(({ studentId }) => studentId) }, isActive: true },
    select: {
      id: true, name: true, organizationId: true,
      studentParentRelations: {
        where: { parent: parentFilter },
        select: { parent: { select: { id: true, organizationId: true } } },
      },
    },
  })
  const recordsByStudent = new Map(records.map((record) => [record.studentId, record]))
  const disabled = new Set((await tx.notificationPreference.findMany({
    where: {
      type, channel: NotificationChannel.IN_APP, enabled: false,
      userId: { in: [...new Set(recipients.flatMap((student) => [
        student.id, ...student.studentParentRelations.map(({ parent }) => parent.id),
      ]))] },
    },
    select: { userId: true },
  })).map(({ userId }) => userId))
  const data = recipients.flatMap((student) => {
    const record = recordsByStudent.get(student.id)!
    const details = `${session.title ?? "Attendance"} · ${attendanceLabels[record.status]}`
    const target = [
      { recipient: student, actionUrl: `/student/classes/${session.classSectionId}?tab=attendance`, body: details },
      ...student.studentParentRelations.filter(({ parent }) => parent.id !== student.id).map(({ parent }) => ({
        recipient: parent, actionUrl: `/parent/students/${student.id}/classes/${session.classSectionId}?tab=attendance`,
        body: `${student.name} · ${details}`,
      })),
    ]
    return target.filter(({ recipient }) => recipient.id !== actorId && !disabled.has(recipient.id))
      .map(({ recipient, actionUrl, body }) => ({
        organizationId: recipient.organizationId, userId: recipient.id, type, actionUrl,
        entityType: "AttendanceRecord", entityId: record.id,
        title: corrected ? "Attendance corrected" : `Attendance · ${attendanceLabels[record.status]}`,
        body: body.slice(0, 500),
      }))
  })
  if (data.length) await tx.notification.createMany({ data })
}
