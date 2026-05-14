import "server-only"

import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import {
  canViewClassSection,
  canViewStudentData,
  requireAnyRole,
} from "@/modules/auth/permissions"

export async function getInstructorClasses() {
  const user = await requireAnyRole([UserRole.INSTRUCTOR, UserRole.HOMEROOM_TEACHER])
  const prisma = getPrismaClient()

  const classSections = await prisma.classSection.findMany({
    where: {
      OR: [
        {
          instructors: {
            some: {
              instructorId: user.id,
            },
          },
        },
        {
          homeroom: {
            teacherId: user.id,
          },
        },
      ],
    },
    include: {
      campus: true,
      course: true,
      term: true,
      _count: {
        select: {
          enrollments: true,
          lessons: true,
          assignments: true,
          quizzes: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return { user, classSections }
}

export async function getStudentClasses() {
  const user = await requireAnyRole([UserRole.STUDENT])
  const prisma = getPrismaClient()

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId: user.id,
    },
    include: {
      classSection: {
        include: {
          campus: true,
          course: true,
          term: true,
          _count: {
            select: {
              lessons: true,
              assignments: true,
              quizzes: true,
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  })

  return { user, enrollments }
}

export async function getParentStudents() {
  const user = await requireAnyRole([UserRole.PARENT])
  const prisma = getPrismaClient()

  const relations = await prisma.parentStudentRelation.findMany({
    where: {
      parentId: user.id,
    },
    include: {
      student: {
        include: {
          studentProfile: {
            include: {
              campus: true,
              currentGradeLevel: true,
            },
          },
          enrollments: {
            include: {
              classSection: {
                include: {
                  course: true,
                  term: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return { user, relations }
}

export async function getClassSectionDetail(
  userId: string,
  classSectionId: string
) {
  if (!(await canViewClassSection(userId, classSectionId))) {
    return null
  }

  return getPrismaClient().classSection.findUnique({
    where: { id: classSectionId },
    include: {
      campus: true,
      course: true,
      term: true,
      instructors: {
        include: {
          instructor: true,
        },
      },
      lessons: {
        orderBy: { sequence: "asc" },
        include: {
          materials: true,
        },
      },
      sessions: {
        orderBy: { startsAt: "asc" },
      },
      attendanceSessions: {
        orderBy: { takenAt: "desc" },
        include: {
          records: true,
        },
      },
      assignments: {
        orderBy: { dueAt: "asc" },
      },
      quizzes: {
        orderBy: { opensAt: "asc" },
      },
      gradeItems: {
        orderBy: { createdAt: "desc" },
      },
      boards: {
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
  })
}

export async function getParentStudentDetail(parentId: string, studentId: string) {
  if (!(await canViewStudentData(parentId, studentId))) {
    return null
  }

  return getPrismaClient().user.findUnique({
    where: { id: studentId },
    include: {
      studentProfile: {
        include: {
          campus: true,
          currentGradeLevel: true,
        },
      },
      enrollments: {
        include: {
          classSection: {
            include: {
              campus: true,
              course: true,
              term: true,
              finalGrades: {
                where: {
                  studentId,
                },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      },
      attendanceRecords: {
        include: {
          attendanceSession: {
            include: {
              classSection: {
                include: {
                  course: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })
}

export function formatDate(value: Date | null | undefined) {
  if (!value) return "-"
  return value.toISOString().slice(0, 10)
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-"
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
