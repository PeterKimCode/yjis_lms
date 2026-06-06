"use server"

import { revalidatePath } from "next/cache"
import {
  AttendanceStatus,
  DeliveryMode,
  NotificationType,
  UserRole,
} from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import { canManageClassSection, requireAnyRole } from "@/modules/auth/permissions"
import {
  createNotification,
  notifyLinkedParentsForStudent,
} from "@/modules/notifications/service"
import { resolvePolicies } from "@/modules/policies/resolve"

const requiredString = z.string().trim().min(1)
const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

function readStringArray(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => (typeof value === "string" ? value : ""))
}

function readDate(value: string) {
  return new Date(value)
}

const classSessionSchema = z.object({
  classSectionId: requiredString,
  title: optionalString,
  startsAt: requiredString.transform(readDate),
  endsAt: optionalString.transform((value) => (value ? readDate(value) : null)),
  location: optionalString,
  meetingUrl: optionalString,
  deliveryMode: z.nativeEnum(DeliveryMode),
})

export async function createClassSession(formData: FormData) {
  await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const data = classSessionSchema.parse(readForm(formData))

  if (!(await canManageClassSectionForAttendance(data.classSectionId))) {
    throw new Error("Forbidden")
  }

  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: {
      organizationId: true,
      campusId: true,
      termId: true,
    },
  })

  await prisma.classSession.create({
    data: {
      organizationId: classSection.organizationId,
      campusId: classSection.campusId,
      classSectionId: data.classSectionId,
      termId: classSection.termId,
      title: data.title,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      location: data.location,
      meetingUrl: data.meetingUrl,
      deliveryMode: data.deliveryMode,
    },
  })

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
}

const attendanceSessionSchema = z.object({
  classSectionId: requiredString,
  classSessionId: requiredString,
  title: optionalString,
})

export async function createAttendanceSession(formData: FormData) {
  await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const data = attendanceSessionSchema.parse(readForm(formData))

  if (!(await canManageClassSectionForAttendance(data.classSectionId))) {
    throw new Error("Forbidden")
  }

  const prisma = getPrismaClient()
  const classSession = await prisma.classSession.findFirstOrThrow({
    where: {
      id: data.classSessionId,
      classSectionId: data.classSectionId,
    },
    select: {
      id: true,
      organizationId: true,
      campusId: true,
      classSectionId: true,
      title: true,
      startsAt: true,
    },
  })
  const attendanceSession = await prisma.attendanceSession.upsert({
    where: { classSessionId: classSession.id },
    update: {
      title: data.title ?? classSession.title ?? "Attendance",
    },
    create: {
      organizationId: classSession.organizationId,
      campusId: classSession.campusId,
      classSectionId: classSession.classSectionId,
      classSessionId: classSession.id,
      title: data.title ?? classSession.title ?? "Attendance",
      takenAt: classSession.startsAt,
    },
  })
  const enrollments = await prisma.enrollment.findMany({
    where: { classSectionId: data.classSectionId },
    select: { studentId: true },
  })

  if (enrollments.length) {
    await prisma.attendanceRecord.createMany({
      data: enrollments.map((enrollment) => ({
        organizationId: classSession.organizationId,
        campusId: classSession.campusId,
        attendanceSessionId: attendanceSession.id,
        studentId: enrollment.studentId,
        status: AttendanceStatus.PRESENT,
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
}

export async function saveAttendanceRecord(formData: FormData) {
  await saveAttendanceRecords(formData)
}

const attendanceRecordBatchSchema = z.object({
  attendanceSessionId: requiredString,
  records: z
    .array(
      z.object({
        note: optionalString,
        status: z.nativeEnum(AttendanceStatus),
        studentId: requiredString,
      })
    )
    .min(1),
})

export async function saveAttendanceRecords(formData: FormData) {
  const actor = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])

  const rowIndexValue = formData.get("recordIndex")
  const rowIndex =
    typeof rowIndexValue === "string" && rowIndexValue.length
      ? Number(rowIndexValue)
      : null
  const studentIds = readStringArray(formData, "studentId")
  const statuses = readStringArray(formData, "status")
  const notes = readStringArray(formData, "note")
  const records = studentIds.map((studentId, index) => ({
    studentId,
    status: statuses[index],
    note: notes[index] ?? "",
  }))
  const selectedRecords =
    rowIndex === null
      ? records
      : Number.isInteger(rowIndex) && records[rowIndex]
        ? [records[rowIndex]]
        : []
  const data = attendanceRecordBatchSchema.parse({
    attendanceSessionId: formData.get("attendanceSessionId"),
    records: selectedRecords,
  })
  const prisma = getPrismaClient()
  const attendanceSession = await prisma.attendanceSession.findUniqueOrThrow({
    where: { id: data.attendanceSessionId },
    select: {
      id: true,
      organizationId: true,
      campusId: true,
      classSectionId: true,
      title: true,
      classSession: {
        select: {
          title: true,
        },
      },
    },
  })

  if (!(await canManageClassSectionForAttendance(attendanceSession.classSectionId))) {
    throw new Error("Forbidden")
  }

  const { attendance: policy } = await resolvePolicies({
    organizationId: attendanceSession.organizationId,
    campusId: attendanceSession.campusId,
    classSectionId: attendanceSession.classSectionId,
  })

  if (!policy.allowInstructorOverride) {
    throw new Error("Attendance policy does not allow instructor overrides.")
  }

  const studentIdsToSave = data.records.map((record) => record.studentId)
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classSectionId: attendanceSession.classSectionId,
      studentId: { in: studentIdsToSave },
    },
    select: { studentId: true },
  })
  const enrolledStudentIds = new Set(enrollments.map((item) => item.studentId))

  if (enrolledStudentIds.size !== studentIdsToSave.length) {
    throw new Error("One or more students are not enrolled in this class section.")
  }

  const checkedInStatuses: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.EARLY_LEAVE,
  ]
  const now = new Date()
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      attendanceSessionId: attendanceSession.id,
      studentId: { in: studentIdsToSave },
    },
    select: {
      note: true,
      status: true,
      studentId: true,
    },
  })
  const existingRecordByStudentId = new Map(
    existingRecords.map((record) => [record.studentId, record])
  )
  const notifications: Array<{
    id: string
    status: AttendanceStatus
    studentId: string
  }> = []

  for (const record of data.records) {
    const isCheckedIn = checkedInStatuses.includes(record.status)
    const existingRecord = existingRecordByStudentId.get(record.studentId)
    const saved = await prisma.attendanceRecord.upsert({
      where: {
        attendanceSessionId_studentId: {
          attendanceSessionId: attendanceSession.id,
          studentId: record.studentId,
        },
      },
      update: {
        status: record.status,
        note: record.note,
        checkedInAt: isCheckedIn ? now : null,
        checkedOutAt:
          record.status === AttendanceStatus.EARLY_LEAVE ? now : null,
      },
      create: {
        organizationId: attendanceSession.organizationId,
        campusId: attendanceSession.campusId,
        attendanceSessionId: attendanceSession.id,
        studentId: record.studentId,
        status: record.status,
        note: record.note,
        checkedInAt: isCheckedIn ? now : null,
        checkedOutAt:
          record.status === AttendanceStatus.EARLY_LEAVE ? now : null,
      },
      select: {
        id: true,
        status: true,
        studentId: true,
      },
    })

    if (
      !existingRecord ||
      existingRecord.status !== record.status ||
      (existingRecord.note ?? null) !== record.note
    ) {
      notifications.push(saved)
    }
  }

  await Promise.all(
    notifications.flatMap((record) => {
      const payload = {
        actorUserId: actor.id,
        actionUrl: `/student/classes/${attendanceSession.classSectionId}`,
        body: `${attendanceSession.title ?? attendanceSession.classSession?.title ?? "Attendance"}: ${record.status}`,
        entityId: record.id,
        entityType: "AttendanceRecord",
        title: "Attendance updated",
        type: NotificationType.ATTENDANCE_UPDATED,
      }

      return [
        createNotification({ ...payload, userId: record.studentId }),
        notifyLinkedParentsForStudent(record.studentId, {
          ...payload,
          actionUrl: `/parent/students/${record.studentId}`,
        }),
      ]
    })
  )

  if (notifications.length) {
    await writeAuditLog({
      action: "attendance.records.update",
      actorUserId: actor.id,
      campusId: attendanceSession.campusId,
      entityId: attendanceSession.id,
      entityType: "AttendanceSession",
      metadata: {
        changedRecordCount: notifications.length,
        classSectionId: attendanceSession.classSectionId,
      },
      organizationId: attendanceSession.organizationId,
      summary: `Updated ${notifications.length} attendance record(s).`,
    })
  }

  revalidatePath(`/instructor/classes/${attendanceSession.classSectionId}`)
  revalidatePath("/notifications")
}

async function canManageClassSectionForAttendance(classSectionId: string) {
  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])

  return canManageClassSection(user.id, classSectionId)
}
