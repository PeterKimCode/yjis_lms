"use server"

import { AttendanceStatus, NotificationChannel, NotificationType, UserRole, type Prisma, type SchoolAttendanceRecord } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getPrismaClient } from "@/lib/prisma"
import { dailyStudentSelect, effectiveSchoolSchedule, findSchoolStaffScope, getDailyStudentContext, getSchoolSchedules, schoolStudents, signedInRole, studentCampus, type SchoolScope } from "./school-data"
import { arrivalStatus, dailyLabels, dailyStatuses, parseMinute, schoolPhase, schoolScopeKey, schoolTime } from "./school-rules"
import { issueReview, issueTicket, qrSecret, readReview, ticketHash } from "./smart-rules"

const id = z.string().min(1).max(80)
const scopeInput = z.object({ organizationId: id, campusId: id.nullable() })
const reviewInput = z.object({ studentId: id, receipt: z.string().min(1).max(80) })
const statuses = z.enum([...dailyStatuses, "PENDING"])
const revisionInput = z.object({
  studentId: id, schoolDate: z.string().max(10), status: statuses, note: z.string().trim().min(1).max(500),
  expectedStatus: statuses, expectedNote: z.string().max(500).nullable(),
})
type TodayKey = { organizationId: string; studentId: string; schoolDate: string }
type StaffScope = NonNullable<Awaited<ReturnType<typeof findSchoolStaffScope>>>
type RecordStatus = keyof typeof dailyLabels

async function staffScope(input: SchoolScope) {
  const parsed = scopeInput.safeParse(input)
  return parsed.success ? findSchoolStaffScope(parsed.data) : null
}

function refreshDailyAttendance() {
  revalidatePath("/admin/attendance/today")
  revalidatePath("/student/school-attendance")
  revalidatePath("/notifications")
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + "T00:00:00Z")
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function saveSchoolAttendanceSchedule(input: SchoolScope, form: FormData) {
  const context = await staffScope(input)
  if (!context) return { error: "You cannot manage this school or campus." }
  const scope = context.scope
  const opensMinute = parseMinute(String(form.get("opens") ?? ""))
  const lateMinute = parseMinute(String(form.get("late") ?? ""))
  const closesMinute = parseMinute(String(form.get("closes") ?? ""))
  const weekdays = [...new Set(form.getAll("weekday").filter((value): value is string => typeof value === "string" && /^[0-6]$/.test(value)).map(Number))].sort()
  const rawDates = form.get("closedDates")
  if (typeof rawDates !== "string" || rawDates.length > 3000) return { error: "Enter up to 200 closure dates." }
  const closedDates = [...new Set(rawDates.trim().split(/[\s,]+/).filter(Boolean))].sort()
  if (opensMinute === null || lateMinute === null || closesMinute === null || opensMinute > lateMinute || lateMinute >= closesMinute) {
    return { error: "Use the same day for all times. Opening must be at or before the late time, and close must be after it." }
  }
  if (!weekdays.length) return { error: "Choose at least one school day." }
  if (closedDates.length > 200 || closedDates.some((date) => !validDate(date))) return { error: "Enter valid closure dates in YYYY-MM-DD format." }
  const schedule = { opensMinute, lateMinute, closesMinute, weekdays, closedDates }
  const scopeKey = schoolScopeKey(scope.organizationId, scope.campusId)
  await getPrismaClient().$transaction(async (tx) => {
    await tx.schoolAttendanceSchedule.upsert({ where: { scopeKey }, create: { scopeKey, ...scope, ...schedule }, update: schedule })
    await tx.auditLog.create({ data: {
      ...scope, actorUserId: context.actor.id, entityId: scopeKey, entityType: "SchoolAttendanceSchedule",
      action: "school-attendance.schedule", metadata: schedule,
    } })
  })
  refreshDailyAttendance()
  return { ok: true }
}

export async function resetCampusAttendanceSchedule(input: SchoolScope) {
  const context = await staffScope(input)
  if (!context?.scope.campusId) return { error: "Choose a campus to restore the school schedule." }
  const scopeKey = schoolScopeKey(context.scope.organizationId, context.scope.campusId)
  await getPrismaClient().$transaction(async (tx) => {
    const result = await tx.schoolAttendanceSchedule.deleteMany({ where: { scopeKey } })
    if (result.count) await tx.auditLog.create({ data: {
      ...context.scope, actorUserId: context.actor.id, entityId: scopeKey, entityType: "SchoolAttendanceSchedule",
      action: "school-attendance.schedule.reset",
    } })
  })
  refreshDailyAttendance()
  return { ok: true }
}

function todayKey(organizationId: string, studentId: string, schoolDate: string): TodayKey {
  return { organizationId, studentId, schoolDate }
}

function ticketContext(organizationId: string, schoolDate: string) {
  return `daily-school:${organizationId}:${schoolDate}`
}

export async function issueSchoolAttendanceQr(expectedDate: string) {
  const context = await getDailyStudentContext()
  const secret = qrSecret()
  if (!context || !secret) return { error: "School attendance is unavailable for this account." }
  const now = new Date()
  const time = schoolTime(now, context.school.timezone)
  if (expectedDate !== time.date) return { error: "A new school day has started. Refresh this page." }
  const { scope, student, schedule } = context
  const key = todayKey(scope.organizationId, student.id, time.date)
  const prisma = getPrismaClient()
  const record = await prisma.schoolAttendanceRecord.findUnique({
    where: { organizationId_studentId_schoolDate: key }, select: { status: true, ticketExpiresAt: true, ticketHash: true },
  })
  if (record && (record.status === "PRESENT" || record.status === "LATE")) return { checkedIn: true }
  if (record && record.status !== "PENDING") return { error: "Your attendance has already been reviewed. Refresh to see the result." }
  if (schoolPhase(schedule, time) !== "open") return { error: "The school check-in window is closed." }
  const ticket = issueTicket(secret, ticketContext(scope.organizationId, time.date), student.id, now.getTime())
  const expiresAt = new Date(ticket.expiresAt)
  const hash = ticketHash(ticket.code)
  if (!record) await prisma.schoolAttendanceRecord.createMany({ data: { ...key, campusId: scope.campusId }, skipDuplicates: true })
  if (record?.ticketHash !== hash) {
    const saved = await prisma.schoolAttendanceRecord.updateMany({
      where: {
        ...key, status: AttendanceStatus.PENDING,
        OR: [{ ticketExpiresAt: null }, { ticketExpiresAt: { lte: expiresAt } }],
      },
      data: { ticketHash: hash, ticketExpiresAt: expiresAt, campusId: scope.campusId },
    })
    if (!saved.count) return { retry: true }
  }
  return { code: ticket.code, validForMs: Math.max(0, ticket.expiresAt - Date.now()) }
}

export async function inspectSchoolAttendanceQr(scope: SchoolScope, code: string) {
  const hash = typeof code === "string" && code.length < 80 ? ticketHash(code.trim()) : null
  if (!hash) return { error: "This is not an LMS attendance QR." }
  const context = await staffScope(scope)
  const secret = qrSecret()
  if (!context || !secret) return { error: "You cannot scan for this school or campus." }
  const now = new Date()
  const time = schoolTime(now, context.organization.timezone)
  const prisma = getPrismaClient()
  const record = await prisma.schoolAttendanceRecord.findUnique({
    where: { ticketHash: hash, organizationId: scope.organizationId, schoolDate: time.date, status: AttendanceStatus.PENDING, ticketExpiresAt: { gt: now } },
    select: { studentId: true },
  })
  if (!record) return { error: "The QR expired, was used, or belongs to a different school. Ask for the current school QR." }
  const [student, schedules] = await Promise.all([
    prisma.user.findFirst({ where: { ...schoolStudents(scope, now), id: record.studentId }, select: dailyStudentSelect }),
    getSchoolSchedules(scope.organizationId),
  ])
  if (!student) return { error: "This student is outside your selected school or campus." }
  const campusId = studentCampus(student, scope.organizationId)
  if (schoolPhase(effectiveSchoolSchedule(schedules, { ...scope, campusId }), time) !== "open") {
    return { error: "The school check-in window has closed for this student." }
  }
  return {
    studentId: student.id, studentName: student.name,
    receipt: issueReview(secret, ticketContext(scope.organizationId, time.date), student.id, context.actor.id, now.getTime()),
  }
}

export async function confirmSchoolAttendance(scope: SchoolScope, input: z.input<typeof reviewInput>) {
  const parsed = reviewInput.safeParse(input)
  const context = await staffScope(scope)
  const secret = qrSecret()
  if (!parsed.success || !context || !secret) return { error: "Scan the student's current QR again." }
  const { studentId, receipt } = parsed.data
  const now = new Date()
  const time = schoolTime(now, context.organization.timezone)
  const scannedAt = readReview(secret, receipt, ticketContext(scope.organizationId, time.date), studentId, context.actor.id, now.getTime())
  if (!scannedAt) return { error: "The identity review expired. Scan the QR again." }
  const result = await getPrismaClient().$transaction(async (tx) => {
    const student = await tx.user.findFirst({ where: { ...schoolStudents(scope, now), id: studentId }, select: dailyStudentSelect })
    if (!student) return { error: "This student is outside your selected school or campus." }
    const campusId = studentCampus(student, scope.organizationId)
    const key = todayKey(scope.organizationId, studentId, time.date)
    const previous = await lockTodayRecord(tx, key, campusId)
    if (previous.status !== "PENDING") return { error: "This student already has a confirmed attendance result." }
    const schedules = await tx.schoolAttendanceSchedule.findMany({ where: { organizationId: scope.organizationId } })
    const schedule = effectiveSchoolSchedule(schedules, { ...scope, campusId })
    const currentTime = schoolTime(new Date(), context.organization.timezone)
    if (!schedule || currentTime.date !== time.date || schoolPhase(schedule, currentTime) !== "open") {
      return { error: "The school check-in window has closed." }
    }
    const status = arrivalStatus(schedule, schoolTime(scannedAt, context.organization.timezone).minute)
    await saveResult(tx, context, previous, campusId, status, null, scannedAt, "school-attendance.check-in")
    return { ok: true }
  })
  if ("ok" in result) refreshDailyAttendance()
  return result
}

export async function reviseSchoolAttendance(scope: SchoolScope, input: z.input<typeof revisionInput>) {
  const parsed = revisionInput.safeParse(input)
  const context = await staffScope(scope)
  if (!parsed.success || !context) return { error: "Choose a status and enter a reason of up to 500 characters." }
  const { studentId, schoolDate, status, note, expectedStatus, expectedNote } = parsed.data
  const now = new Date()
  const time = schoolTime(now, context.organization.timezone)
  if (schoolDate !== time.date) return { error: "This roster is from a different date. Refresh today's attendance." }
  const result = await getPrismaClient().$transaction(async (tx) => {
    const student = await tx.user.findFirst({ where: { ...schoolStudents(scope, now), id: studentId }, select: dailyStudentSelect })
    if (!student) return { error: "This student is outside your selected school or campus." }
    const campusId = studentCampus(student, scope.organizationId)
    const schedules = await tx.schoolAttendanceSchedule.findMany({ where: { organizationId: scope.organizationId } })
    const phase = schoolPhase(effectiveSchoolSchedule(schedules, { ...scope, campusId }), time)
    if (phase === "setup" || phase === "closed-day") return { error: "There is no school attendance scheduled today for this student." }
    if (status === "ABSENT" && phase !== "review") return { error: "Review absences after the check-in window closes." }
    const previous = await lockTodayRecord(tx, todayKey(scope.organizationId, studentId, time.date), campusId)
    if (previous.status !== expectedStatus || previous.note !== expectedNote) {
      return { error: "This record was changed by another staff member. Refresh before correcting it." }
    }
    await saveResult(tx, context, previous, campusId, status, note, status === "PRESENT" || status === "LATE" ? previous.checkedInAt ?? now : null, "school-attendance.revise")
    return { ok: true }
  })
  if ("ok" in result) refreshDailyAttendance()
  return result
}

export async function confirmSchoolAbsences(scope: SchoolScope, schoolDate: string, studentIds: string[]) {
  const parsed = z.array(id).min(1).max(40).safeParse(studentIds)
  const context = await staffScope(scope)
  if (!parsed.success || !context) return { error: "Choose eligible unconfirmed students in your scope." }
  const now = new Date()
  const time = schoolTime(now, context.organization.timezone)
  if (schoolDate !== time.date) return { error: "This roster is from a different date. Refresh today's attendance." }
  const count = await getPrismaClient().$transaction(async (tx) => {
    const students = await tx.user.findMany({
      where: { ...schoolStudents(scope, now), id: { in: parsed.data } }, select: dailyStudentSelect, orderBy: { id: "asc" },
    })
    const schedules = await tx.schoolAttendanceSchedule.findMany({ where: { organizationId: scope.organizationId } })
    let updated = 0
    for (const student of students) {
      const campusId = studentCampus(student, scope.organizationId)
      if (schoolPhase(effectiveSchoolSchedule(schedules, { ...scope, campusId }), time) !== "review") continue
      const previous = await lockTodayRecord(tx, todayKey(scope.organizationId, student.id, time.date), campusId)
      if (previous.status !== "PENDING") continue
      await saveResult(tx, context, previous, campusId, "ABSENT", "Absence confirmed during daily attendance review.", null, "school-attendance.absence")
      updated += 1
    }
    return updated
  }, { timeout: 25_000 })
  refreshDailyAttendance()
  return { ok: true, count }
}

async function lockTodayRecord(tx: Prisma.TransactionClient, key: TodayKey, campusId: string | null) {
  await tx.schoolAttendanceRecord.createMany({ data: { ...key, campusId }, skipDuplicates: true })
  await tx.$queryRaw`SELECT id FROM "SchoolAttendanceRecord"
    WHERE "organizationId" = ${key.organizationId} AND "studentId" = ${key.studentId} AND "schoolDate" = ${key.schoolDate} FOR UPDATE`
  return tx.schoolAttendanceRecord.findUniqueOrThrow({ where: { organizationId_studentId_schoolDate: key } })
}

async function saveResult(tx: Prisma.TransactionClient, context: StaffScope, previous: SchoolAttendanceRecord, campusId: string | null,
  status: RecordStatus, note: string | null, checkedInAt: Date | null, action: string) {
  if (previous.status === status && previous.note === note) return
  const { organizationId, studentId, schoolDate } = previous
  const updated = await tx.schoolAttendanceRecord.update({
    where: { id: previous.id }, data: { campusId, status, note, checkedInAt, updatedById: context.actor.id, ticketHash: null, ticketExpiresAt: null },
  })
  await tx.auditLog.create({ data: {
    organizationId, campusId, actorUserId: context.actor.id, entityType: "SchoolAttendanceRecord",
    entityId: updated.id, action, metadata: { studentId, schoolDate, previous: previous.status, status, note },
  } })
  if (previous.status === status) return
  const type = NotificationType.ATTENDANCE_UPDATED
  const channel = NotificationChannel.IN_APP
  const student = await tx.user.findUniqueOrThrow({ where: { id: studentId }, select: { name: true } })
  const links = await tx.parentStudentRelation.findMany({
    where: {
      studentId,
      parent: {
        isActive: true, id: { not: context.actor.id },
        roleAssignments: { some: signedInRole(UserRole.PARENT, new Date()) },
        notificationPreferences: { none: { type, channel, enabled: false } },
      },
    },
    select: { parent: { select: { id: true, organizationId: true } } },
  })
  if (links.length) await tx.notification.createMany({
    data: links.map(({ parent }) => ({
      organizationId: parent.organizationId, userId: parent.id, type, channel,
      title: previous.status === "PENDING" ? `School attendance · ${dailyLabels[status]}` : "School attendance corrected",
      body: `${student.name} · ${context.organization.name} · ${schoolDate} · ${dailyLabels[status]}`.slice(0, 500),
      actionUrl: `/parent/students/${studentId}`,
      entityType: "SchoolAttendanceRecord", entityId: updated.id,
    })),
  })
}
