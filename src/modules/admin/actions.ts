"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  DeliveryMode,
  EnrollmentStatus,
  InstitutionType,
  UserRole,
} from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { assertAdminScope, requireAdmin } from "@/modules/admin/access"
import { hashPassword } from "@/modules/auth/password"
import { ensureDefaultPoliciesForCampus } from "@/modules/policies/initialize"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
)

const requiredString = z.string().trim().min(1)
const optionalInt = optionalString.transform((value) =>
  value === null ? null : Number.parseInt(value, 10)
)
const optionalDecimal = optionalString
const checkboxBoolean = z
  .union([z.literal("on"), z.null()])
  .transform((value) => value === "on")

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function maybeId(value: string | null | undefined) {
  return value && value.length > 0 ? value : undefined
}

async function revalidateAdmin(path: string) {
  revalidatePath(path)
  revalidatePath("/admin")
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

const organizationSchema = z.object({
  id: optionalString,
  name: requiredString,
  institutionType: z.nativeEnum(InstitutionType),
  isActive: checkboxBoolean,
})

export async function saveOrganization(formData: FormData) {
  const data = organizationSchema.parse({
    ...readForm(formData),
    isActive: formData.get("isActive"),
  })
  const { id, ...values } = data
  const admin = await requireAdmin()
  const canCreateOrganization = admin.roleAssignments.some(
    (assignment) => assignment.role === UserRole.SUPER_ADMIN
  )

  if (id) {
    await assertAdminScope({ organizationId: id })
  } else if (!canCreateOrganization) {
    throw new Error("Only super admins can create organizations.")
  }

  if (id) {
    await getPrismaClient().organization.update({
      where: { id },
      data: values,
    })
  } else {
    await getPrismaClient().organization.create({
      data: {
        ...values,
        slug: slugify(values.name),
      },
    })
  }
  await revalidateAdmin("/admin/organizations")
}

const campusSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  name: requiredString,
  code: optionalString,
  address: optionalString,
  phone: optionalString,
  isActive: checkboxBoolean,
})

export async function saveCampus(formData: FormData) {
  const data = campusSchema.parse({
    ...readForm(formData),
    isActive: formData.get("isActive"),
  })
  const { id, ...values } = data

  await assertAdminScope({ organizationId: values.organizationId })
  const prisma = getPrismaClient()
  try {
    await prisma.$transaction(async (tx) => {
      const campus = id
        ? await tx.campus.update({
            where: { id },
            data: values,
          })
        : await tx.campus.create({
            data: values,
          })

      await ensureDefaultPoliciesForCampus(
        {
          organizationId: campus.organizationId,
          campusId: campus.id,
        },
        tx
      )
    })
  } catch (error) {
    console.error("Campus policy initialization failed", {
      organizationId: values.organizationId,
      campusId: id,
      error: error instanceof Error ? error.message : String(error),
    })
    redirect("/admin/campuses?policyInitFailed=1")
  }
  await revalidateAdmin("/admin/campuses")
  await revalidateAdmin("/admin/policies")
  if (!id) {
    redirect("/admin/campuses?createdWithPolicies=1")
  }
}

const userSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  name: requiredString,
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().trim().optional().default(""),
  role: z.nativeEnum(UserRole),
  currentGradeLevelId: optionalString,
  homeroomId: optionalString,
  studentNumber: optionalString,
  admissionYear: optionalString,
  isActive: checkboxBoolean,
})

export async function saveUser(formData: FormData) {
  const data = userSchema.parse({
    ...readForm(formData),
    isActive: formData.get("isActive"),
  })
  const {
    id,
    password,
    role,
    campusId,
    currentGradeLevelId,
    homeroomId,
    studentNumber,
    admissionYear,
    ...userValues
  } = data

  await assertAdminScope({ organizationId: userValues.organizationId, campusId })

  if (!id && password.length < 8) {
    throw new Error("Password must be at least 8 characters.")
  }

  const passwordData = password
    ? { passwordHash: await hashPassword(password) }
    : {}
  const prisma = getPrismaClient()
  const user = id
    ? await prisma.user.update({
        where: { id },
        data: { ...userValues, ...passwordData },
      })
    : await prisma.user.create({
        data: { ...userValues, ...passwordData },
      })

  const existingRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  })

  if (existingRole) {
    await prisma.userRoleAssignment.update({
      where: { id: existingRole.id },
      data: {
        organizationId: userValues.organizationId,
        campusId,
        role,
      },
    })
  } else {
    await prisma.userRoleAssignment.create({
      data: {
        organizationId: userValues.organizationId,
        campusId,
        userId: user.id,
        role,
      },
    })
  }

  if (role === UserRole.STUDENT) {
    const admissionDate = admissionYear
      ? new Date(`${admissionYear}-01-01T00:00:00.000Z`)
      : undefined

    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId: userValues.organizationId,
        campusId,
        currentGradeLevelId,
        homeroomId,
        studentNumber,
        ...(admissionDate ? { admissionDate } : {}),
      },
      create: {
        organizationId: userValues.organizationId,
        campusId,
        userId: user.id,
        currentGradeLevelId,
        homeroomId,
        studentNumber,
        admissionDate,
      },
    })
  }

  await revalidateAdmin("/admin/users")
  await revalidateAdmin(`/admin/users/${user.id}`)
}

const parentStudentRelationSchema = z.object({
  parentId: requiredString,
  studentId: requiredString,
  relation: optionalString,
  isPrimary: checkboxBoolean,
})

export async function saveParentStudentRelation(formData: FormData) {
  const data = parentStudentRelationSchema.parse({
    ...readForm(formData),
    isPrimary: formData.get("isPrimary"),
  })
  const prisma = getPrismaClient()
  const [parent, student] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: {
        id: data.parentId,
        roleAssignments: { some: { role: UserRole.PARENT } },
      },
      select: { id: true, organizationId: true },
    }),
    prisma.user.findFirstOrThrow({
      where: {
        id: data.studentId,
        roleAssignments: { some: { role: UserRole.STUDENT } },
      },
      select: { id: true, organizationId: true },
    }),
  ])

  if (parent.organizationId !== student.organizationId) {
    throw new Error("Parent and student must belong to the same organization.")
  }

  await assertAdminScope({ organizationId: parent.organizationId })
  await prisma.parentStudentRelation.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: student.id,
      },
    },
    update: {
      relation: data.relation ?? "Guardian",
      isPrimary: data.isPrimary,
    },
    create: {
      organizationId: parent.organizationId,
      parentId: parent.id,
      studentId: student.id,
      relation: data.relation ?? "Guardian",
      isPrimary: data.isPrimary,
    },
  })

  await revalidateAdmin("/admin/users")
  await revalidateAdmin(`/admin/users/${parent.id}`)
  await revalidateAdmin(`/admin/users/${student.id}`)
}

const removeParentStudentRelationSchema = z.object({
  relationId: requiredString,
})

export async function removeParentStudentRelation(formData: FormData) {
  const data = removeParentStudentRelationSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const relation = await prisma.parentStudentRelation.findUniqueOrThrow({
    where: { id: data.relationId },
    select: {
      id: true,
      organizationId: true,
      parentId: true,
      studentId: true,
    },
  })

  await assertAdminScope({ organizationId: relation.organizationId })
  await prisma.parentStudentRelation.delete({ where: { id: relation.id } })
  await revalidateAdmin("/admin/users")
  await revalidateAdmin(`/admin/users/${relation.parentId}`)
  await revalidateAdmin(`/admin/users/${relation.studentId}`)
}

const academicYearSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  name: requiredString,
  startsAt: requiredString.transform(toDate),
  endsAt: requiredString.transform(toDate),
  isActive: checkboxBoolean,
})

export async function saveAcademicYear(formData: FormData) {
  const data = academicYearSchema.parse({
    ...readForm(formData),
    isActive: formData.get("isActive"),
  })
  const { id, ...values } = data

  await assertAdminScope(data)
  await getPrismaClient().academicYear.upsert({
    where: { id: maybeId(id) ?? "__new_academic_year__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/academic-years")
}

const termSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  academicYearId: requiredString,
  name: requiredString,
  startsAt: requiredString.transform(toDate),
  endsAt: requiredString.transform(toDate),
  sequence: z.coerce.number().int().min(1),
  isActive: checkboxBoolean,
})

export async function saveTerm(formData: FormData) {
  const data = termSchema.parse({
    ...readForm(formData),
    isActive: formData.get("isActive"),
  })
  const { id, ...values } = data

  await assertAdminScope(data)
  await getPrismaClient().term.upsert({
    where: { id: maybeId(id) ?? "__new_term__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/terms")
}

const gradeLevelSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  academicYearId: optionalString,
  name: requiredString,
  code: optionalString,
  sequence: z.coerce.number().int().min(1),
})

export async function saveGradeLevel(formData: FormData) {
  const data = gradeLevelSchema.parse(readForm(formData))
  const { id, ...values } = data

  await assertAdminScope(data)
  await getPrismaClient().gradeLevel.upsert({
    where: { id: maybeId(id) ?? "__new_grade_level__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/grade-levels")
}

const homeroomSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  academicYearId: requiredString,
  gradeLevelId: optionalString,
  teacherId: optionalString,
  name: requiredString,
})

export async function saveHomeroom(formData: FormData) {
  const data = homeroomSchema.parse(readForm(formData))
  const { id, ...values } = data

  await assertAdminScope(data)
  await getPrismaClient().homeroom.upsert({
    where: { id: maybeId(id) ?? "__new_homeroom__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/homerooms")
  if (id) {
    await revalidateAdmin(`/admin/homerooms/${id}`)
  }
}

const departmentSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  name: requiredString,
  code: optionalString,
})

export async function saveDepartment(formData: FormData) {
  const data = departmentSchema.parse(readForm(formData))
  const { id, ...values } = data

  await assertAdminScope(data)
  await getPrismaClient().department.upsert({
    where: { id: maybeId(id) ?? "__new_department__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/departments")
}

const courseSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  departmentId: optionalString,
  code: optionalString,
  title: requiredString,
  description: optionalString,
  credits: optionalDecimal,
  defaultDeliveryMode: z.nativeEnum(DeliveryMode),
})

export async function saveCourse(formData: FormData) {
  const data = courseSchema.parse(readForm(formData))
  const { id, ...values } = data

  await assertAdminScope(data)
  await getPrismaClient().course.upsert({
    where: { id: maybeId(id) ?? "__new_course__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/courses")
}

const classSectionSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  academicYearId: requiredString,
  termId: optionalString,
  courseId: requiredString,
  gradeLevelId: optionalString,
  homeroomId: optionalString,
  name: requiredString,
  sectionCode: optionalString,
  deliveryMode: z.nativeEnum(DeliveryMode),
  capacity: optionalInt,
})

export async function saveClassSection(formData: FormData) {
  const data = classSectionSchema.parse(readForm(formData))
  const { id, ...values } = data

  await assertAdminScope(data)
  const prisma = getPrismaClient()
  const classSection = id
    ? await prisma.classSection.update({
        where: { id },
        data: values,
        select: { id: true },
      })
    : await prisma.classSection.create({
        data: values,
        select: { id: true },
      })
  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${classSection.id}`)
  redirect(`/admin/class-sections/${classSection.id}`)
}

const instructorAssignmentSchema = z.object({
  classSectionId: requiredString,
  instructorId: requiredString,
  roleLabel: z.enum(["PRIMARY", "ASSISTANT", "TA"]),
})

export async function assignClassSectionInstructor(formData: FormData) {
  const data = instructorAssignmentSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true, campusId: true },
  })

  await assertAdminScope(classSection)

  const instructor = await prisma.user.findFirstOrThrow({
    where: {
      id: data.instructorId,
      roleAssignments: {
        some: {
          role: {
            in: [
              UserRole.INSTRUCTOR,
              UserRole.HOMEROOM_TEACHER,
              UserRole.ACADEMIC_STAFF,
            ],
          },
        },
      },
    },
    select: { id: true },
  })

  await prisma.classSectionInstructor.upsert({
    where: {
      classSectionId_instructorId: {
        classSectionId: data.classSectionId,
        instructorId: instructor.id,
      },
    },
    update: {
      roleLabel: data.roleLabel,
      isPrimary: data.roleLabel === "PRIMARY",
    },
    create: {
      organizationId: classSection.organizationId,
      classSectionId: data.classSectionId,
      instructorId: instructor.id,
      roleLabel: data.roleLabel,
      isPrimary: data.roleLabel === "PRIMARY",
    },
  })

  await revalidateAdmin("/admin/class-sections")
}

const removeInstructorAssignmentSchema = z.object({
  assignmentId: requiredString,
})

export async function removeClassSectionInstructor(formData: FormData) {
  const data = removeInstructorAssignmentSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const assignment = await prisma.classSectionInstructor.findUniqueOrThrow({
    where: { id: data.assignmentId },
    include: {
      classSection: {
        select: { organizationId: true, campusId: true },
      },
    },
  })

  await assertAdminScope(assignment.classSection)
  await prisma.classSectionInstructor.delete({ where: { id: assignment.id } })
  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${assignment.classSectionId}`)
}

const enrollmentSchema = z.object({
  classSectionId: requiredString,
  studentId: requiredString,
  status: z.nativeEnum(EnrollmentStatus),
})

export async function saveEnrollment(formData: FormData) {
  const data = enrollmentSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true, campusId: true },
  })

  await assertAdminScope(classSection)

  const student = await prisma.user.findFirstOrThrow({
    where: {
      id: data.studentId,
      roleAssignments: {
        some: { role: UserRole.STUDENT },
      },
    },
    select: { id: true },
  })
  const statusDates = enrollmentStatusDates(data.status)

  await prisma.enrollment.upsert({
    where: {
      classSectionId_studentId: {
        classSectionId: data.classSectionId,
        studentId: student.id,
      },
    },
    update: {
      status: data.status,
      ...statusDates,
    },
    create: {
      organizationId: classSection.organizationId,
      campusId: classSection.campusId,
      classSectionId: data.classSectionId,
      studentId: student.id,
      status: data.status,
      ...statusDates,
    },
  })

  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${data.classSectionId}`)
}

const removeEnrollmentSchema = z.object({
  enrollmentId: requiredString,
})

export async function removeEnrollment(formData: FormData) {
  const data = removeEnrollmentSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { id: data.enrollmentId },
    include: {
      classSection: {
        select: { organizationId: true, campusId: true },
      },
    },
  })

  await assertAdminScope(enrollment.classSection)
  await prisma.enrollment.delete({ where: { id: enrollment.id } })
  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${enrollment.classSectionId}`)
}

const homeroomPlacementSchema = z.object({
  studentId: requiredString,
  homeroomId: requiredString,
})

export async function assignStudentToHomeroom(formData: FormData) {
  const data = homeroomPlacementSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const homeroom = await prisma.homeroom.findUniqueOrThrow({
    where: { id: data.homeroomId },
    select: {
      organizationId: true,
      campusId: true,
      gradeLevelId: true,
    },
  })
  const student = await prisma.user.findFirstOrThrow({
    where: {
      id: data.studentId,
      roleAssignments: {
        some: { role: UserRole.STUDENT },
      },
    },
    select: { id: true },
  })

  await assertAdminScope(homeroom)
  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      organizationId: homeroom.organizationId,
      campusId: homeroom.campusId,
      currentGradeLevelId: homeroom.gradeLevelId,
      homeroomId: data.homeroomId,
    },
    create: {
      organizationId: homeroom.organizationId,
      campusId: homeroom.campusId,
      userId: student.id,
      currentGradeLevelId: homeroom.gradeLevelId,
      homeroomId: data.homeroomId,
    },
  })

  await revalidateAdmin("/admin/homerooms")
  await revalidateAdmin(`/admin/homerooms/${data.homeroomId}`)
  await revalidateAdmin("/admin/users")
}

const removeStudentHomeroomSchema = z.object({
  studentId: requiredString,
  homeroomId: requiredString,
})

export async function removeStudentFromHomeroom(formData: FormData) {
  const data = removeStudentHomeroomSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const homeroom = await prisma.homeroom.findUniqueOrThrow({
    where: { id: data.homeroomId },
    select: { organizationId: true, campusId: true },
  })

  await assertAdminScope(homeroom)
  await prisma.studentProfile.updateMany({
    where: {
      userId: data.studentId,
      homeroomId: data.homeroomId,
    },
    data: {
      homeroomId: null,
    },
  })

  await revalidateAdmin("/admin/homerooms")
  await revalidateAdmin(`/admin/homerooms/${data.homeroomId}`)
  await revalidateAdmin("/admin/users")
}

const bulkHomeroomEnrollmentSchema = z.object({
  classSectionId: requiredString,
  homeroomId: requiredString,
})

export async function enrollHomeroomInClassSection(formData: FormData) {
  const data = bulkHomeroomEnrollmentSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true, campusId: true },
  })

  await assertAdminScope(classSection)

  const students = await prisma.studentProfile.findMany({
    where: {
      homeroomId: data.homeroomId,
      organizationId: classSection.organizationId,
    },
    select: {
      userId: true,
    },
  })

  if (students.length) {
    await prisma.enrollment.createMany({
      data: students.map((student) => ({
        organizationId: classSection.organizationId,
        campusId: classSection.campusId,
        classSectionId: data.classSectionId,
        studentId: student.userId,
        status: EnrollmentStatus.ENROLLED,
      })),
      skipDuplicates: true,
    })
  }

  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${data.classSectionId}`)
}

function enrollmentStatusDates(status: EnrollmentStatus) {
  const now = new Date()

  return {
    completedAt: status === EnrollmentStatus.COMPLETED ? now : null,
    droppedAt:
      status === EnrollmentStatus.DROPPED ||
      status === EnrollmentStatus.WITHDRAWN
        ? now
        : null,
  }
}
