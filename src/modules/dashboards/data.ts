import "server-only"

import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import {
  canViewClassSection,
  canViewStudentData,
  requireAnyRole,
} from "@/modules/auth/permissions"
import { resolvePolicies } from "@/modules/policies/resolve"

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
  classSectionId: string,
  options: { publishedLessonsOnly?: boolean } = {}
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
        where: options.publishedLessonsOnly ? { isPublished: true } : undefined,
        orderBy: { sequence: "asc" },
        include: {
          materials: true,
          videoProgress: {
            include: {
              student: true,
            },
          },
        },
      },
      enrollments: {
        include: {
          student: true,
        },
        orderBy: { enrolledAt: "asc" },
      },
      sessions: {
        orderBy: { startsAt: "asc" },
        include: {
          attendanceSession: true,
        },
      },
      attendanceSessions: {
        orderBy: { takenAt: "desc" },
        include: {
          classSession: true,
          records: {
            include: {
              student: true,
            },
            orderBy: {
              student: {
                name: "asc",
              },
            },
          },
        },
      },
      assignments: {
        orderBy: { dueAt: "asc" },
        include: {
          submissions: {
            include: {
              student: true,
              attachments: {
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { submittedAt: "desc" },
          },
        },
      },
      quizzes: {
        where: options.publishedLessonsOnly ? { isPublished: true } : undefined,
        orderBy: { opensAt: "asc" },
        include: {
          questions: {
            include: { options: { orderBy: { sequence: "asc" } } },
            orderBy: { sequence: "asc" },
          },
          attempts: {
            include: {
              student: true,
              answers: { include: { question: true, selectedOption: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      exams: {
        orderBy: { startsAt: "asc" },
      },
      gradingConfig: true,
      gradeCategories: {
        orderBy: { sequence: "asc" },
      },
      gradeItems: {
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          scores: {
            include: {
              student: true,
            },
          },
        },
      },
      finalGrades: {
        where: options.publishedLessonsOnly
          ? {
              status: {
                in: ["PUBLISHED", "FINALIZED"],
              },
              studentId: userId,
            }
          : undefined,
        include: {
          student: true,
        },
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

export async function getAttendancePolicyForOrganization(organizationId: string) {
  const policies = await resolvePolicies({ organizationId })
  return policies.attendance
}

export async function getAttendancePolicyForClassSection(input: {
  organizationId: string
  campusId?: string | null
  classSectionId: string
}) {
  const policies = await resolvePolicies(input)
  return policies.attendance
}

export async function getPublishedLessonForStudent({
  studentId,
  classSectionId,
  lessonId,
}: {
  studentId: string
  classSectionId: string
  lessonId: string
}) {
  if (!(await canViewClassSection(studentId, classSectionId))) {
    return null
  }

  return getPrismaClient().lesson.findFirst({
    where: {
      id: lessonId,
      classSectionId,
      isPublished: true,
    },
    include: {
      classSection: {
        include: {
          campus: true,
          course: true,
          term: true,
        },
      },
      videoFileAsset: true,
      videoProgress: {
        where: {
          studentId,
        },
        take: 1,
      },
    },
  })
}

export async function getVideoFileOptionsForClassSection({
  classSectionId,
  organizationId,
  campusId,
}: {
  classSectionId: string
  organizationId: string
  campusId: string | null
}) {
  const files = await getPrismaClient().fileAsset.findMany({
    where: {
      organizationId,
      OR: [
        { classSectionId },
        { classSectionId: null, campusId },
        { classSectionId: null, campusId: null },
      ],
      AND: [
        {
          OR: [
            { contentType: { startsWith: "video/" } },
            { originalName: { endsWith: ".mp4", mode: "insensitive" } },
            { originalName: { endsWith: ".webm", mode: "insensitive" } },
            { originalName: { endsWith: ".mov", mode: "insensitive" } },
            { originalName: { endsWith: ".m4v", mode: "insensitive" } },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      byteSize: true,
    },
  })

  return files.map((file) => ({
    id: file.id,
    label: `${file.originalName}${file.byteSize ? ` (${formatBytes(file.byteSize)})` : ""}`,
  }))
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
                  status: {
                    in: ["PUBLISHED", "FINALIZED"],
                  },
                },
              },
              assignments: {
                include: {
                  submissions: {
                    where: { studentId },
                    include: {
                      attachments: {
                        orderBy: { createdAt: "desc" },
                      },
                    },
                  },
                },
                orderBy: { dueAt: "asc" },
              },
              quizzes: {
                include: {
                  questions: {
                    orderBy: { sequence: "asc" },
                  },
                  attempts: {
                    where: { studentId },
                    include: {
                      answers: { include: { question: true, selectedOption: true } },
                    },
                    orderBy: { createdAt: "desc" },
                  },
                },
                orderBy: { opensAt: "asc" },
              },
              boards: {
                where: { isActive: true },
                orderBy: { name: "asc" },
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
              classSession: true,
              classSection: {
                include: {
                  campus: true,
                  course: true,
                  term: true,
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

function formatBytes(value: bigint) {
  const bytes = Number(value)

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${bytes} B`
}
