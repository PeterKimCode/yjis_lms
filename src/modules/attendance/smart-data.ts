import "server-only"
import { EnrollmentStatus, UserRole, type Prisma } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { canManageClassSection, getCurrentUser } from "@/modules/auth/permissions"

const staffRoles = new Set<UserRole>([
  UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SCHOOL_ADMIN,
  UserRole.ACADEMIC_STAFF, UserRole.INSTRUCTOR, UserRole.HOMEROOM_TEACHER,
])

export async function getSmartAttendanceManager(classSectionId: string) {
  const actor = await getCurrentUser()
  if (!actor?.roleAssignments.some(({ role }) => staffRoles.has(role))) return null
  return await canManageClassSection(actor.id, classSectionId) ? actor : null
}

export function activeAttendanceEnrollment(classSectionId: string, studentId?: string): Prisma.EnrollmentWhereInput {
  return { classSectionId, studentId, status: EnrollmentStatus.ENROLLED, student: { isActive: true } }
}

export async function getStudentQrSessions(studentId: string) {
  const prisma = getPrismaClient()
  const now = new Date()
  return prisma.attendanceSession.findMany({
    where: {
      qrOpenedAt: { lte: now },
      qrClosesAt: { gt: now },
      qrFinalizedAt: null,
      qrCheckIns: { some: { studentId } },
      classSection: {
        enrollments: { some: { studentId, status: EnrollmentStatus.ENROLLED } },
      },
    },
    select: { id: true, title: true, classSection: { select: { id: true, name: true } } },
    orderBy: { takenAt: "desc" },
  })
}
