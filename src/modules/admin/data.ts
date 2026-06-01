import "server-only"

import { Prisma, UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import {
  getAcademicYearWhereForAdmin,
  getCampusWhereForAdmin,
  getClassSectionWhereForAdmin,
  getCourseWhereForAdmin,
  getDepartmentWhereForAdmin,
  getGradeLevelWhereForAdmin,
  getHomeroomWhereForAdmin,
  getOrganizationWhereForAdmin,
  getTermWhereForAdmin,
  getUserWhereForAdmin,
  isSuperAdmin,
  requireAdmin,
} from "@/modules/admin/access"

export async function getAdminData() {
  const user = await requireAdmin()
  const prisma = getPrismaClient()
  const isSuperAdmin = user.roleAssignments.some(
    (assignment) => assignment.role === UserRole.SUPER_ADMIN
  )

  const organizations = await prisma.organization.findMany({
    where: getOrganizationWhereForAdmin(user),
    orderBy: { name: "asc" },
  })
  const organizationLogos = organizations.length
    ? await prisma.$queryRaw<Array<{ id: string; logoFileAssetId: string | null }>>`
        SELECT "id", "logoFileAssetId"
        FROM "Organization"
        WHERE "id" IN (${Prisma.join(organizations.map((organization) => organization.id))})
      `
    : []
  const logoByOrganizationId = new Map(
    organizationLogos.map((row) => [row.id, row.logoFileAssetId])
  )

  const campuses = await prisma.campus.findMany({
    where: getCampusWhereForAdmin(user),
    include: { organization: true },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
  })

  return {
    user,
    isSuperAdmin,
    organizations: organizations.map((organization) => ({
      ...organization,
      logoFileAsset: logoByOrganizationId.get(organization.id)
        ? { id: logoByOrganizationId.get(organization.id) as string }
        : null,
    })),
    campuses,
    organizationOptions: organizations.map((organization) => ({
      id: organization.id,
      label: organization.name,
    })),
    campusOptions: campuses.map((campus) => ({
      id: campus.id,
      label: `${campus.name} (${campus.organization.name})`,
      organizationId: campus.organizationId,
    })),
  }
}

export async function getAcademicSetupOptions() {
  const admin = await getAdminData()
  const prisma = getPrismaClient()

  const [
    academicYears,
    terms,
    gradeLevels,
    homerooms,
    departments,
    courses,
    classSections,
    users,
  ] = await Promise.all([
      prisma.academicYear.findMany({
        where: getAcademicYearWhereForAdmin(admin.user),
        include: { campus: true, organization: true },
        orderBy: { startsAt: "desc" },
      }),
      prisma.term.findMany({
        where: getTermWhereForAdmin(admin.user),
        include: { campus: true, organization: true },
        orderBy: [{ startsAt: "desc" }, { sequence: "asc" }],
      }),
      prisma.gradeLevel.findMany({
        where: getGradeLevelWhereForAdmin(admin.user),
        include: { campus: true, organization: true },
        orderBy: [{ sequence: "asc" }, { name: "asc" }],
      }),
      prisma.homeroom.findMany({
        where: getHomeroomWhereForAdmin(admin.user),
        include: {
          campus: true,
          organization: true,
          gradeLevel: true,
          teacher: true,
          studentProfiles: {
            include: {
              user: true,
            },
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: { studentProfiles: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: getDepartmentWhereForAdmin(admin.user),
        include: { campus: true, organization: true },
        orderBy: { name: "asc" },
      }),
      prisma.course.findMany({
        where: getCourseWhereForAdmin(admin.user),
        include: { campus: true, organization: true },
        orderBy: { title: "asc" },
      }),
      prisma.classSection.findMany({
        where: getClassSectionWhereForAdmin(admin.user),
        include: {
          campus: true,
          organization: true,
          course: true,
          term: true,
          instructors: {
            include: {
              instructor: true,
            },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          enrollments: {
            include: {
              student: {
                include: {
                  studentProfile: {
                    include: {
                      currentGradeLevel: true,
                      homeroom: true,
                    },
                  },
                },
              },
            },
            orderBy: { enrolledAt: "asc" },
          },
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          ...getUserWhereForAdmin(admin.user),
        },
        include: {
          roleAssignments: true,
          instructorProfile: true,
          studentProfile: {
            include: {
              currentGradeLevel: true,
              homeroom: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ])

  return {
    ...admin,
    academicYears,
    terms,
    gradeLevels,
    homerooms,
    departments,
    courses,
    classSections,
    userOptions: users.map((user) => ({
      id: user.id,
      label: `${user.name}${user.email ? ` (${user.email})` : ""}`,
      organizationId: user.organizationId,
    })),
    instructorOptions: users
      .filter((user) =>
        user.roleAssignments.some((assignment) =>
          ([
            UserRole.INSTRUCTOR,
            UserRole.HOMEROOM_TEACHER,
            UserRole.ACADEMIC_STAFF,
          ] as UserRole[]).includes(assignment.role)
        )
      )
      .map((user) => {
        const roleScope = user.roleAssignments.find((assignment) =>
          ([
            UserRole.INSTRUCTOR,
            UserRole.HOMEROOM_TEACHER,
            UserRole.ACADEMIC_STAFF,
          ] as UserRole[]).includes(assignment.role)
        )

        return {
          id: user.id,
          label: `${user.name}${user.email ? ` (${user.email})` : ""}`,
          organizationId:
            user.instructorProfile?.organizationId ??
            roleScope?.organizationId ??
            user.organizationId,
          campusId: user.instructorProfile?.campusId ?? roleScope?.campusId ?? null,
        }
      }),
    studentOptions: users
      .filter((user) =>
        user.roleAssignments.some(
          (assignment) => assignment.role === UserRole.STUDENT
        )
      )
      .map((user) => {
        const roleScope = user.roleAssignments.find(
          (assignment) => assignment.role === UserRole.STUDENT
        )

        return {
          id: user.id,
          label: `${user.name}${user.email ? ` (${user.email})` : ""}${
            user.studentProfile?.homeroom
              ? ` - ${user.studentProfile.homeroom.name}`
              : ""
          }`,
          organizationId:
            user.studentProfile?.organizationId ??
            roleScope?.organizationId ??
            user.organizationId,
          campusId: user.studentProfile?.campusId ?? roleScope?.campusId ?? null,
        }
      }),
    parentOptions: users
      .filter((user) =>
        user.roleAssignments.some(
          (assignment) => assignment.role === UserRole.PARENT
        )
      )
      .map((user) => ({
        id: user.id,
        label: `${user.name}${user.email ? ` (${user.email})` : ""}`,
        organizationId: user.organizationId,
      })),
    academicYearOptions: academicYears.map((year) => ({
      id: year.id,
      label: year.name,
      organizationId: year.organizationId,
      campusId: year.campusId,
    })),
    termOptions: terms.map((term) => ({
      id: term.id,
      label: term.name,
      organizationId: term.organizationId,
      campusId: term.campusId,
    })),
    gradeLevelOptions: gradeLevels.map((gradeLevel) => ({
      id: gradeLevel.id,
      label: gradeLevel.name,
      organizationId: gradeLevel.organizationId,
      campusId: gradeLevel.campusId,
    })),
    homeroomOptions: homerooms.map((homeroom) => ({
      id: homeroom.id,
      label: homeroom.name,
      organizationId: homeroom.organizationId,
      campusId: homeroom.campusId,
    })),
    departmentOptions: departments.map((department) => ({
      id: department.id,
      label: department.name,
      organizationId: department.organizationId,
      campusId: department.campusId,
    })),
    courseOptions: courses.map((course) => ({
      id: course.id,
      label: course.title,
      organizationId: course.organizationId,
      campusId: course.campusId,
    })),
  }
}

export async function getClassSectionDetailForAdmin(classSectionId: string) {
  const admin = await getAcademicSetupOptions()
  const classSection = admin.classSections.find(
    (section) => section.id === classSectionId
  )

  return classSection ? { ...admin, classSection } : null
}

export async function getHomeroomDetailForAdmin(homeroomId: string) {
  const admin = await getAcademicSetupOptions()
  const homeroom = admin.homerooms.find((item) => item.id === homeroomId)

  return homeroom ? { ...admin, homeroom } : null
}

export async function getAdminUserDetail(userId: string) {
  const admin = await getAcademicSetupOptions()
  const user = await getPrismaClient().user.findFirst({
    where: {
      id: userId,
      ...getUserWhereForAdmin(admin.user),
    },
    include: {
      organization: true,
      avatarFileAsset: {
        select: {
          id: true,
          originalName: true,
        },
      },
      studentProfile: {
        include: {
          campus: true,
          currentGradeLevel: true,
          homeroom: true,
        },
      },
      roleAssignments: {
        include: { campus: true },
        orderBy: { createdAt: "asc" },
      },
      parentRelations: {
        include: {
          student: {
            include: {
              studentProfile: {
                include: {
                  currentGradeLevel: true,
                  homeroom: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      studentParentRelations: {
        include: {
          parent: true,
        },
        orderBy: { createdAt: "asc" },
      },
      enrollments: {
        include: {
          classSection: {
            include: {
              campus: true,
              course: true,
              term: true,
              instructors: {
                include: {
                  instructor: true,
                },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              },
              lessons: {
                where: { isPublished: true },
                include: {
                  videoProgress: {
                    where: { studentId: userId },
                    take: 1,
                  },
                },
                orderBy: { sequence: "asc" },
              },
              attendanceSessions: {
                include: {
                  classSession: true,
                  records: {
                    where: { studentId: userId },
                  },
                },
                orderBy: { takenAt: "desc" },
              },
              assignments: {
                include: {
                  submissions: {
                    where: { studentId: userId },
                    include: {
                      attachments: {
                        orderBy: { createdAt: "desc" },
                      },
                    },
                    take: 1,
                    orderBy: { updatedAt: "desc" },
                  },
                },
                orderBy: { dueAt: "desc" },
              },
              quizzes: {
                include: {
                  questions: {
                    select: {
                      points: true,
                    },
                  },
                  attempts: {
                    where: { studentId: userId },
                    orderBy: { createdAt: "desc" },
                  },
                },
                orderBy: { opensAt: "desc" },
              },
              exams: {
                orderBy: { startsAt: "desc" },
              },
              finalGrades: {
                where: { studentId: userId },
                orderBy: { updatedAt: "desc" },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      },
      finalGrades: {
        include: {
          classSection: {
            include: {
              course: true,
              term: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      generatedDocuments: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  if (!user) return null

  const roles = user.roleAssignments.map((assignment) => assignment.role)
  const isStudent = roles.includes(UserRole.STUDENT)
  const adminHasCampusScope = admin.user.roleAssignments.some(
    (assignment) => assignment.campusId
  )
  const scopedCampusIds = new Set(admin.campuses.map((campus) => campus.id))

  if (
    isStudent &&
    !isSuperAdmin(admin.user) &&
    adminHasCampusScope &&
    user.studentProfile?.campusId &&
    !scopedCampusIds.has(user.studentProfile.campusId)
  ) {
    return null
  }

  return {
    ...admin,
    user,
    studentAcademic: isStudent ? user.enrollments : null,
  }
}

export async function getAdminStudentClassRecord(
  studentId: string,
  classSectionId: string
) {
  const detail = await getAdminUserDetail(studentId)

  if (!detail) return null

  const roles = detail.user.roleAssignments.map((assignment) => assignment.role)

  if (!roles.includes(UserRole.STUDENT)) return null

  const enrollment = detail.user.enrollments.find(
    (item) => item.classSectionId === classSectionId
  )

  if (!enrollment) return null

  return {
    ...detail,
    enrollment,
  }
}

export function formatDate(value: Date | null | undefined) {
  if (!value) return ""
  return value.toISOString().slice(0, 10)
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-"
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
