"use server"

import { revalidatePath } from "next/cache"
import { AttendanceStatus, DeliveryMode, UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { canManageClassSection, requireAnyRole } from "@/modules/auth/permissions"
import { resolvePolicies } from "@/modules/policies/resolve"

const requiredString = z.string().trim().min(1)
const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
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
        status: AttendanceStatus.PENDING,
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
}

const attendanceRecordSchema = z.object({
  attendanceSessionId: requiredString,
  studentId: requiredString,
  status: z.nativeEnum(AttendanceStatus),
  note: optionalString,
})

export async function saveAttendanceRecord(formData: FormData) {
  await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const data = attendanceRecordSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const attendanceSession = await prisma.attendanceSession.findUniqueOrThrow({
    where: { id: data.attendanceSessionId },
    select: {
      id: true,
      organizationId: true,
      campusId: true,
      classSectionId: true,
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

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      classSectionId_studentId: {
        classSectionId: attendanceSession.classSectionId,
        studentId: data.studentId,
      },
    },
    select: { id: true },
  })

  if (!enrollment) {
    throw new Error("Student is not enrolled in this class section.")
  }

  const checkedInStatuses: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.LATE,
    AttendanceStatus.EARLY_LEAVE,
  ]
  const isCheckedIn = checkedInStatuses.includes(data.status)
  const now = new Date()

  await prisma.attendanceRecord.upsert({
    where: {
      attendanceSessionId_studentId: {
        attendanceSessionId: attendanceSession.id,
        studentId: data.studentId,
      },
    },
    update: {
      status: data.status,
      note: data.note,
      checkedInAt: isCheckedIn ? now : null,
      checkedOutAt: data.status === AttendanceStatus.EARLY_LEAVE ? now : null,
    },
    create: {
      organizationId: attendanceSession.organizationId,
      campusId: attendanceSession.campusId,
      attendanceSessionId: attendanceSession.id,
      studentId: data.studentId,
      status: data.status,
      note: data.note,
      checkedInAt: isCheckedIn ? now : null,
      checkedOutAt: data.status === AttendanceStatus.EARLY_LEAVE ? now : null,
    },
  })

  revalidatePath(`/instructor/classes/${attendanceSession.classSectionId}`)
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
