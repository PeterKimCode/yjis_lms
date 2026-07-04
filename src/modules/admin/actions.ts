"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  DeliveryMode,
  EnrollmentStatus,
  InstitutionType,
  NotificationType,
  Prisma,
  UserDeletionRequestStatus,
  UserRole,
} from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import {
  assertAdminScope,
  getUserWhereForAdmin,
  requireAdmin,
} from "@/modules/admin/access"
import { adminRoles, hasSuperAdminRole } from "@/modules/admin/scope-rules"
import { isSelectableUserRole } from "@/modules/admin/role-options"
import type { AdminFormState } from "@/modules/admin/form-state"
import { writeAuditLog } from "@/modules/audit/service"
import { hashPassword } from "@/modules/auth/password"
import { uploadImageFile } from "@/modules/files/upload"
import { createNotificationsForUsers } from "@/modules/notifications/service"
import { ensureDefaultOrganization } from "@/modules/organizations/default-organization"
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

function toYearStartDate(value: string) {
  return /^\d{4}$/.test(value)
    ? new Date(`${value}-01-01T00:00:00.000Z`)
    : toDate(value)
}

function toYearEndDate(value: string) {
  return /^\d{4}$/.test(value)
    ? new Date(`${value}-12-31T00:00:00.000Z`)
    : toDate(value)
}

function maybeId(value: string | null | undefined) {
  return value && value.length > 0 ? value : undefined
}

function redirectWithAdminError(path: string, message: string): never {
  redirect(`${path}?saveError=${encodeURIComponent(message)}`)
}

function isSchoolAdminOnly(roleAssignments: { role: UserRole }[]) {
  return (
    roleAssignments.some((assignment) => assignment.role === UserRole.SCHOOL_ADMIN) &&
    !roleAssignments.some((assignment) => assignment.role === UserRole.SUPER_ADMIN)
  )
}

async function assertSchoolAdminUserOnly() {
  const admin = await requireAdmin()
  if (isSchoolAdminOnly(admin.roleAssignments)) {
    throw new Error("School admins can only view and edit users.")
  }
  return admin
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

async function createUniqueOrganizationSlug(
  prisma: ReturnType<typeof getPrismaClient>,
  value: string,
  excludeId?: string | null
) {
  const baseSlug = slugify(value) || "organization"
  let slug = baseSlug
  let suffix = 2

  while (
    await prisma.organization.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return slug
}

const organizationSchema = z.object({
  id: optionalString,
  name: requiredString,
  slug: optionalString,
  institutionType: z.nativeEnum(InstitutionType),
  websiteUrl: optionalString,
  isActive: checkboxBoolean,
})

export async function saveOrganization(formData: FormData) {
  const data = organizationSchema.parse({
    ...readForm(formData),
    isActive: formData.get("isActive"),
  })
  const { id, slug, ...values } = data
  const admin = await assertSchoolAdminUserOnly()
  const logo = formData.get("logo")
  const canCreateOrganization = admin.roleAssignments.some(
    (assignment) => assignment.role === UserRole.SUPER_ADMIN
  )

  if (id) {
    await assertAdminScope({ organizationId: id })
  } else if (!canCreateOrganization) {
    redirectWithAdminError(
      "/admin/organizations",
      "Only super admins can create organizations."
    )
  }

  const prisma = getPrismaClient()
  const safeSlug = await createUniqueOrganizationSlug(
    prisma,
    slug ?? values.name,
    id
  )
  const organization = id
    ? await prisma.organization.update({
        where: { id },
        data: {
          ...values,
          slug: safeSlug,
        },
        select: { id: true },
      })
    : await prisma.organization.create({
        data: {
          ...values,
          slug: safeSlug,
        },
        select: { id: true },
      })

  await writeAuditLog({
    action: id ? "organization.update" : "organization.create",
    actorUserId: admin.id,
    entityId: organization.id,
    entityType: "Organization",
    organizationId: organization.id,
    summary: id
      ? `Updated organization ${values.name}`
      : `Created organization ${values.name}`,
  })

  if (logo instanceof File && logo.size > 0) {
    const upload = await uploadImageFile({
      campusId: null,
      file: logo,
      metadata: { source: "organization-logo", organizationId: organization.id },
      organizationId: organization.id,
      ownerId: admin.id,
      prefix: `organizations/${organization.id}/logo`,
    })

    if (!upload.ok) {
      redirectWithAdminError("/admin/organizations", upload.message)
    }

    await prisma.$executeRaw`
      UPDATE "Organization"
      SET "logoFileAssetId" = ${upload.fileAsset.id}
      WHERE "id" = ${organization.id}
    `
  }

  await revalidateAdmin("/admin/organizations")
  revalidatePath("/")
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
  await assertSchoolAdminUserOnly()
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
  organizationId: optionalString,
  campusId: optionalString,
  name: requiredString,
  email: z
    .string()
    .trim()
    .min(1, "Login ID is required.")
    .max(191, "Login ID must be 191 characters or fewer."),
  password: z.string().trim().optional().default(""),
  role: z.nativeEnum(UserRole),
  currentGradeLevelId: optionalString,
  homeroomId: optionalString,
  studentNumber: optionalString,
  admissionYear: optionalString,
  isActive: checkboxBoolean,
})

export async function saveUserWithState(
  _previousState: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    await saveUser(formData)
    return { ok: true, message: "User saved." }
  } catch (error) {
    return { ok: false, message: getActionErrorMessage(error) }
  }
}

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
    ...rawUserValues
  } = data
  const prisma = getPrismaClient()
  const fallbackOrganization = rawUserValues.organizationId
    ? null
    : await ensureDefaultOrganization(prisma)
  const userValues = {
    ...rawUserValues,
    organizationId: rawUserValues.organizationId ?? fallbackOrganization!.id,
  }

  await assertAdminScope({ organizationId: userValues.organizationId, campusId })
  const adminUser = await requireAdmin()

  if (!isSelectableUserRole(role)) {
    throw new Error("This role is no longer available for user accounts.")
  }

  if (adminRoles.includes(role) && !hasSuperAdminRole(adminUser.roleAssignments)) {
    throw new Error("Only super admins can create or assign admin accounts.")
  }

  if (!id && password.length < 8) {
    throw new Error("Password must be at least 8 characters.")
  }

  const passwordData = password
    ? { passwordHash: await hashPassword(password) }
    : {}
  if (id) {
    const editableUser = await prisma.user.findFirst({
      where: {
        id,
        ...getUserWhereForAdmin(adminUser),
      },
      select: { id: true },
    })

    if (!editableUser) {
      throw new Error("You do not have permission to edit this user.")
    }
  }

  const duplicateLoginUser = await prisma.user.findFirst({
    where: {
      email: userValues.email,
      ...(id ? { id: { not: id } } : {}),
    },
    select: { id: true },
  })

  if (duplicateLoginUser) {
    throw new Error("This login ID is already used by another user.")
  }

  if (campusId) {
    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      select: { organizationId: true },
    })
    if (!campus || campus.organizationId !== userValues.organizationId) {
      throw new Error("Selected campus does not belong to the selected organization.")
    }
  }

  if (currentGradeLevelId) {
    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: currentGradeLevelId },
      select: { organizationId: true, campusId: true },
    })
    if (
      !gradeLevel ||
      gradeLevel.organizationId !== userValues.organizationId ||
      (campusId && gradeLevel.campusId && gradeLevel.campusId !== campusId)
    ) {
      throw new Error("Selected student grade does not belong to this scope.")
    }
  }

  if (homeroomId) {
    const homeroom = await prisma.homeroom.findUnique({
      where: { id: homeroomId },
      select: { organizationId: true, campusId: true },
    })
    if (
      !homeroom ||
      homeroom.organizationId !== userValues.organizationId ||
      (campusId && homeroom.campusId && homeroom.campusId !== campusId)
    ) {
      throw new Error("Selected homeroom does not belong to this scope.")
    }
  }

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

  await writeAuditLog({
    action: id ? "user.update" : "user.create",
    actorUserId: adminUser.id,
    campusId,
    entityId: user.id,
    entityType: "User",
    metadata: {
      role,
      email: userValues.email,
    },
    organizationId: userValues.organizationId,
    summary: id
      ? `Updated user ${userValues.email}`
      : `Created user ${userValues.email}`,
  })

  await revalidateAdmin("/admin/users")
  await revalidateAdmin(`/admin/users/${user.id}`)
}

function getActionErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the form values."
  }

  if (error instanceof Error) {
    return error.message || "The request could not be completed."
  }

  return "The request could not be completed."
}

export type AdminUserAvatarState = {
  message: string
  ok: boolean
}

const adminUserAvatarSchema = z.object({
  userId: requiredString,
})

export async function updateAdminUserAvatar(
  _state: AdminUserAvatarState,
  formData: FormData
): Promise<AdminUserAvatarState> {
  const data = adminUserAvatarSchema.parse(readForm(formData))
  const file = formData.get("avatar")

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Choose a JPG, PNG, WEBP, or GIF image first.",
    }
  }

  const prisma = getPrismaClient()
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      roleAssignments: {
        select: { campusId: true },
        take: 1,
      },
    },
  })

  if (!user) {
    return { ok: false, message: "User account was not found." }
  }

  await assertAdminScope({
    organizationId: user.organizationId,
    campusId: user.roleAssignments[0]?.campusId ?? null,
  })

  try {
    const upload = await uploadImageFile({
      campusId: user.roleAssignments[0]?.campusId ?? null,
      file,
      metadata: { source: "admin-user-avatar", userId: user.id },
      organizationId: user.organizationId,
      ownerId: user.id,
      prefix: `users/${user.id}/avatar`,
    })

    if (!upload.ok) {
      return { ok: false, message: upload.message }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { avatarFileAssetId: upload.fileAsset.id },
    })

    await revalidateAdmin("/admin/users")
    await revalidateAdmin(`/admin/users/${user.id}`)

    return { ok: true, message: "Profile photo updated." }
  } catch (error) {
    console.error("Admin avatar upload failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      ok: false,
      message: "Image upload failed. Please try again.",
    }
  }
}

export async function removeAdminUserAvatar(
  _state: AdminUserAvatarState,
  formData: FormData
): Promise<AdminUserAvatarState> {
  const data = adminUserAvatarSchema.parse(readForm(formData))
  const prisma = getPrismaClient()
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: {
      id: true,
      organizationId: true,
      avatarFileAssetId: true,
      roleAssignments: {
        select: { campusId: true },
        take: 1,
      },
    },
  })

  if (!user) {
    return { ok: false, message: "User account was not found." }
  }

  await assertAdminScope({
    organizationId: user.organizationId,
    campusId: user.roleAssignments[0]?.campusId ?? null,
  })

  if (!user.avatarFileAssetId) {
    return { ok: true, message: "No profile photo is set." }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarFileAssetId: null },
  })

  await revalidateAdmin("/admin/users")
  await revalidateAdmin(`/admin/users/${user.id}`)

  return { ok: true, message: "Profile photo removed." }
}

const parentStudentRelationSchema = z.object({
  parentId: requiredString,
  studentId: requiredString,
  relation: optionalString,
  isPrimary: checkboxBoolean,
})

export async function saveParentStudentRelation(formData: FormData) {
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
  startsAt: requiredString.transform(toYearStartDate),
  endsAt: requiredString.transform(toYearEndDate),
  isActive: checkboxBoolean,
})

export async function saveAcademicYear(formData: FormData) {
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
  academicYearId: optionalString,
  termId: optionalString,
  courseId: requiredString,
  gradeLevelId: optionalString,
  homeroomId: optionalString,
  name: requiredString,
  sectionCode: optionalString,
  deliveryMode: z.nativeEnum(DeliveryMode),
  capacity: optionalInt,
})

const deleteAdminEntitySchema = z.object({
  entity: z.enum([
    "academicYear",
    "board",
    "campus",
    "classSection",
    "course",
    "department",
    "gradeLevel",
    "homeroom",
    "organization",
    "term",
    "user",
  ]),
  id: requiredString,
  returnPath: requiredString,
})

function safeReturnPath(value: string) {
  return value.startsWith("/admin") ? value : "/admin"
}

function withDeleteMessage(path: string, key: "deleted" | "deleteError", entity: string) {
  const separator = path.includes("?") ? "&" : "?"

  return `${path}${separator}${key}=${encodeURIComponent(entity)}`
}

export async function deleteAdminEntity(formData: FormData) {
  const data = deleteAdminEntitySchema.parse(readForm(formData))
  const returnPath = safeReturnPath(data.returnPath)
  await assertSchoolAdminUserOnly()
  const prisma = getPrismaClient()
  let redirectTo = withDeleteMessage(returnPath, "deleted", data.entity)

  try {
    switch (data.entity) {
      case "organization": {
        const organization = await prisma.organization.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, name: true },
        })
        await assertAdminScope({ organizationId: organization.id })
        const fallbackOrganization = await ensureDefaultOrganization(prisma)

        if (fallbackOrganization.id === organization.id) {
          throw new Error("The default fallback organization cannot be deleted.")
        }

        await prisma.$transaction(async (tx) => {
          await tx.user.updateMany({
            where: { organizationId: organization.id },
            data: { organizationId: fallbackOrganization.id },
          })
          await tx.userRoleAssignment.updateMany({
            where: { organizationId: organization.id },
            data: {
              organizationId: fallbackOrganization.id,
              campusId: null,
              startsAt: null,
              endsAt: null,
            },
          })
          await tx.studentProfile.deleteMany({
            where: { organizationId: organization.id },
          })
          await tx.instructorProfile.deleteMany({
            where: { organizationId: organization.id },
          })
          await tx.parentStudentRelation.deleteMany({
            where: { organizationId: organization.id },
          })
          await tx.organization.delete({ where: { id: organization.id } })
        })
        await writeAuditLog({
          action: "organization.delete",
          actorUserId: (await requireAdmin()).id,
          entityId: organization.id,
          entityType: "Organization",
          metadata: {
            fallbackOrganizationId: fallbackOrganization.id,
          },
          organizationId: fallbackOrganization.id,
          summary: `Deleted organization ${organization.name}; moved users to fallback organization.`,
        })
        await revalidateAdmin("/admin/organizations")
        await revalidateAdmin("/admin/users")
        break
      }
      case "campus": {
        const campus = await prisma.campus.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true },
        })
        await assertAdminScope(campus)
        await prisma.campus.delete({ where: { id: campus.id } })
        await revalidateAdmin("/admin/campuses")
        break
      }
      case "department": {
        const department = await prisma.department.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(department)
        await prisma.department.delete({ where: { id: department.id } })
        await revalidateAdmin("/admin/departments")
        break
      }
      case "academicYear": {
        const academicYear = await prisma.academicYear.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(academicYear)
        await prisma.academicYear.delete({ where: { id: academicYear.id } })
        await revalidateAdmin("/admin/academic-years")
        break
      }
      case "term": {
        const term = await prisma.term.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(term)
        await prisma.term.delete({ where: { id: term.id } })
        await revalidateAdmin("/admin/terms")
        break
      }
      case "gradeLevel": {
        const gradeLevel = await prisma.gradeLevel.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(gradeLevel)
        await prisma.gradeLevel.delete({ where: { id: gradeLevel.id } })
        await revalidateAdmin("/admin/grade-levels")
        break
      }
      case "homeroom": {
        const homeroom = await prisma.homeroom.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(homeroom)
        await prisma.homeroom.delete({ where: { id: homeroom.id } })
        await revalidateAdmin("/admin/homerooms")
        break
      }
      case "course": {
        const course = await prisma.course.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(course)
        await prisma.course.delete({ where: { id: course.id } })
        await revalidateAdmin("/admin/courses")
        break
      }
      case "classSection": {
        const section = await prisma.classSection.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(section)
        await prisma.classSection.delete({ where: { id: section.id } })
        await revalidateAdmin("/admin/class-sections")
        break
      }
      case "board": {
        const board = await prisma.board.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true, campusId: true },
        })
        await assertAdminScope(board)
        await prisma.board.delete({ where: { id: board.id } })
        await revalidateAdmin("/admin/boards")
        break
      }
      case "user": {
        const admin = await requireAdmin()
        if (!hasSuperAdminRole(admin.roleAssignments)) {
          throw new Error("Only super admins can delete users. Please request deletion approval.")
        }
        if (admin.id === data.id) {
          throw new Error("You cannot delete your own signed-in account.")
        }
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, organizationId: true },
        })
        await assertAdminScope({ organizationId: user.organizationId })
        await prisma.user.delete({ where: { id: user.id } })
        await revalidateAdmin("/admin/users")
        break
      }
    }
  } catch (error) {
    console.error("Admin delete failed", {
      entity: data.entity,
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    })
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2003", "P2014"].includes(error.code)
    ) {
      redirectTo = withDeleteMessage(returnPath, "deleteError", data.entity)
    } else if (error instanceof Error) {
      redirectTo = withDeleteMessage(returnPath, "deleteError", data.entity)
    } else {
      redirectTo = withDeleteMessage(returnPath, "deleteError", data.entity)
    }
  }

  redirect(redirectTo)
}

const requestUserDeletionSchema = z.object({
  id: optionalString,
  userId: optionalString,
  returnPath: requiredString,
})

export async function requestUserDeletion(formData: FormData) {
  const data = requestUserDeletionSchema.parse(readForm(formData))
  const userId = data.userId ?? data.id
  if (!userId) {
    redirect("/admin/users?requestError=user")
  }
  const returnPath = safeReturnPath(data.returnPath)
  const admin = await requireAdmin()
  const prisma = getPrismaClient()

  if (hasSuperAdminRole(admin.roleAssignments)) {
    redirect(`${returnPath}?requestError=user`)
  }

  if (admin.id === userId) {
    redirect(`${returnPath}?requestError=user`)
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      ...getUserWhereForAdmin(admin),
    },
    select: {
      id: true,
      email: true,
      name: true,
      organizationId: true,
    },
  })

  if (!user) {
    redirect(`${returnPath}?requestError=user`)
  }

  await assertAdminScope({ organizationId: user.organizationId })

  const existing = await prisma.userDeletionRequest.findFirst({
    where: {
      targetUserId: user.id,
      status: UserDeletionRequestStatus.PENDING,
    },
    select: { id: true },
  })

  if (existing) {
    redirect(`${returnPath}?deleteRequested=user`)
  }

  const request = await prisma.userDeletionRequest.create({
    data: {
      organizationId: user.organizationId,
      requestedById: admin.id,
      targetUserId: user.id,
      targetUserLoginId: user.email,
      targetUserName: user.name,
    },
    select: { id: true },
  })

  const superAdmins = await prisma.user.findMany({
    where: {
      isActive: true,
      roleAssignments: {
        some: { role: UserRole.SUPER_ADMIN },
      },
    },
    select: { id: true },
  })

  await createNotificationsForUsers(
    superAdmins.map((item) => item.id),
    {
      actionUrl: "/admin/users",
      actorUserId: admin.id,
      body: `${admin.name} requested deletion approval for ${user.name}.`,
      entityId: request.id,
      entityType: "UserDeletionRequest",
      title: "User deletion approval requested",
      type: NotificationType.SYSTEM_NOTICE,
    }
  )

  await writeAuditLog({
    action: "user.delete.request",
    actorUserId: admin.id,
    entityId: user.id,
    entityType: "User",
    organizationId: user.organizationId,
    summary: `Requested deletion approval for user ${user.email ?? user.name}.`,
  })

  await revalidateAdmin("/admin/users")
  redirect(`${returnPath}?deleteRequested=user`)
}

const reviewUserDeletionRequestSchema = z.object({
  requestId: requiredString,
  decision: z.enum(["approve", "reject"]),
  returnPath: requiredString,
})

export async function reviewUserDeletionRequest(formData: FormData) {
  const data = reviewUserDeletionRequestSchema.parse(readForm(formData))
  const returnPath = safeReturnPath(data.returnPath)
  const admin = await requireAdmin()

  if (!hasSuperAdminRole(admin.roleAssignments)) {
    redirect(`${returnPath}?reviewError=user`)
  }

  const prisma = getPrismaClient()
  const request = await prisma.userDeletionRequest.findUnique({
    where: { id: data.requestId },
    include: {
      targetUser: {
        select: {
          id: true,
          email: true,
          name: true,
          organizationId: true,
        },
      },
    },
  })

  if (!request || request.status !== UserDeletionRequestStatus.PENDING) {
    redirect(`${returnPath}?reviewError=user`)
  }

  if (data.decision === "reject") {
    await prisma.userDeletionRequest.update({
      where: { id: request.id },
      data: {
        reviewedAt: new Date(),
        reviewedById: admin.id,
        status: UserDeletionRequestStatus.REJECTED,
      },
    })
    await writeAuditLog({
      action: "user.delete.reject",
      actorUserId: admin.id,
      entityId: request.targetUserId,
      entityType: "User",
      organizationId: request.organizationId,
      summary: `Rejected deletion request for user ${request.targetUserLoginId ?? request.targetUserName}.`,
    })
    await revalidateAdmin("/admin/users")
    redirect(`${returnPath}?reviewed=rejected`)
  }

  if (!request.targetUser) {
    redirect(`${returnPath}?reviewError=user`)
  }

  if (request.targetUser.id === admin.id) {
    redirect(`${returnPath}?reviewError=user`)
  }

  await prisma.$transaction(async (tx) => {
    await tx.userDeletionRequest.update({
      where: { id: request.id },
      data: {
        reviewedAt: new Date(),
        reviewedById: admin.id,
        status: UserDeletionRequestStatus.APPROVED,
      },
    })
    await tx.user.delete({ where: { id: request.targetUser!.id } })
  })

  await writeAuditLog({
    action: "user.delete.approve",
    actorUserId: admin.id,
    entityId: request.targetUser.id,
    entityType: "User",
    organizationId: request.targetUser.organizationId,
    summary: `Approved deletion request and deleted user ${request.targetUser.email ?? request.targetUser.name}.`,
  })

  await revalidateAdmin("/admin/users")
  redirect(`${returnPath}?reviewed=approved`)
}

const resourceDeletionEntitySchema = z.enum(["course", "classSection"])

const resourceDeletionPathByEntity = {
  course: "/admin/courses",
  classSection: "/admin/class-sections",
} satisfies Record<z.infer<typeof resourceDeletionEntitySchema>, string>

async function getDeletionResourceTarget(
  entity: z.infer<typeof resourceDeletionEntitySchema>,
  id: string
) {
  const prisma = getPrismaClient()

  if (entity === "course") {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        campusId: true,
        organizationId: true,
        title: true,
      },
    })

    return course
      ? {
          campusId: course.campusId,
          entityId: course.id,
          entityName: course.title,
          entityType: entity,
          organizationId: course.organizationId,
        }
      : null
  }

  const section = await prisma.classSection.findUnique({
    where: { id },
    select: {
      id: true,
      campusId: true,
      name: true,
      organizationId: true,
    },
  })

  return section
    ? {
        campusId: section.campusId,
        entityId: section.id,
        entityName: section.name,
        entityType: entity,
        organizationId: section.organizationId,
      }
    : null
}

const requestResourceDeletionSchema = z.object({
  entity: resourceDeletionEntitySchema,
  id: requiredString,
  returnPath: requiredString,
})

export async function requestResourceDeletion(formData: FormData) {
  const data = requestResourceDeletionSchema.parse(readForm(formData))
  const returnPath = safeReturnPath(data.returnPath)
  const admin = await requireAdmin()

  if (hasSuperAdminRole(admin.roleAssignments)) {
    redirect(`${returnPath}?requestError=${data.entity}`)
  }

  const target = await getDeletionResourceTarget(data.entity, data.id)
  if (!target) {
    redirect(`${returnPath}?requestError=${data.entity}`)
  }

  await assertAdminScope(target)
  const prisma = getPrismaClient()
  const existing = await prisma.resourceDeletionRequest.findFirst({
    where: {
      entityId: target.entityId,
      entityType: target.entityType,
      status: UserDeletionRequestStatus.PENDING,
    },
    select: { id: true },
  })

  if (existing) {
    redirect(`${returnPath}?deleteRequested=${target.entityType}`)
  }

  const request = await prisma.resourceDeletionRequest.create({
    data: {
      campusId: target.campusId,
      entityId: target.entityId,
      entityName: target.entityName,
      entityType: target.entityType,
      organizationId: target.organizationId,
      requestedById: admin.id,
    },
    select: { id: true },
  })

  const superAdmins = await prisma.user.findMany({
    where: {
      isActive: true,
      roleAssignments: {
        some: { role: UserRole.SUPER_ADMIN },
      },
    },
    select: { id: true },
  })

  await createNotificationsForUsers(
    superAdmins.map((item) => item.id),
    {
      actionUrl: resourceDeletionPathByEntity[target.entityType],
      actorUserId: admin.id,
      body: `${admin.name} requested deletion approval for ${target.entityName}.`,
      entityId: request.id,
      entityType: "ResourceDeletionRequest",
      title: "Deletion approval requested",
      type: NotificationType.SYSTEM_NOTICE,
    }
  )

  await writeAuditLog({
    action: `${target.entityType}.delete.request`,
    actorUserId: admin.id,
    entityId: target.entityId,
    entityType: target.entityType,
    organizationId: target.organizationId,
    campusId: target.campusId,
    summary: `Requested deletion approval for ${target.entityType} ${target.entityName}.`,
  })

  await revalidateAdmin(resourceDeletionPathByEntity[target.entityType])
  redirect(`${returnPath}?deleteRequested=${target.entityType}`)
}

const reviewResourceDeletionRequestSchema = z.object({
  requestId: requiredString,
  decision: z.enum(["approve", "reject"]),
  returnPath: requiredString,
})

export async function reviewResourceDeletionRequest(formData: FormData) {
  const data = reviewResourceDeletionRequestSchema.parse(readForm(formData))
  const returnPath = safeReturnPath(data.returnPath)
  const admin = await requireAdmin()

  if (!hasSuperAdminRole(admin.roleAssignments)) {
    redirect(`${returnPath}?reviewError=resource`)
  }

  const prisma = getPrismaClient()
  const request = await prisma.resourceDeletionRequest.findUnique({
    where: { id: data.requestId },
  })

  if (!request || request.status !== UserDeletionRequestStatus.PENDING) {
    redirect(`${returnPath}?reviewError=resource`)
  }

  const entity = resourceDeletionEntitySchema.safeParse(request.entityType)
  if (!entity.success) {
    redirect(`${returnPath}?reviewError=resource`)
  }

  if (data.decision === "reject") {
    await prisma.resourceDeletionRequest.update({
      where: { id: request.id },
      data: {
        reviewedAt: new Date(),
        reviewedById: admin.id,
        status: UserDeletionRequestStatus.REJECTED,
      },
    })
    await writeAuditLog({
      action: `${request.entityType}.delete.reject`,
      actorUserId: admin.id,
      entityId: request.entityId,
      entityType: request.entityType,
      organizationId: request.organizationId,
      campusId: request.campusId,
      summary: `Rejected deletion request for ${request.entityType} ${request.entityName}.`,
    })
    await revalidateAdmin(resourceDeletionPathByEntity[entity.data])
    redirect(`${returnPath}?reviewed=rejected`)
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (entity.data === "course") {
        await tx.course.delete({ where: { id: request.entityId } })
      } else {
        await tx.classSection.delete({ where: { id: request.entityId } })
      }

      await tx.resourceDeletionRequest.update({
        where: { id: request.id },
        data: {
          reviewedAt: new Date(),
          reviewedById: admin.id,
          status: UserDeletionRequestStatus.APPROVED,
        },
      })
    })
  } catch (error) {
    console.error("Resource deletion approval failed", {
      entityId: request.entityId,
      entityType: request.entityType,
      error: error instanceof Error ? error.message : String(error),
    })
    redirect(`${returnPath}?reviewError=${request.entityType}`)
  }

  await writeAuditLog({
    action: `${request.entityType}.delete.approve`,
    actorUserId: admin.id,
    entityId: request.entityId,
    entityType: request.entityType,
    organizationId: request.organizationId,
    campusId: request.campusId,
    summary: `Approved deletion request and deleted ${request.entityType} ${request.entityName}.`,
  })

  await revalidateAdmin(resourceDeletionPathByEntity[entity.data])
  redirect(`${returnPath}?reviewed=approved`)
}

export async function saveClassSection(formData: FormData) {
  await assertSchoolAdminUserOnly()
  const parsed = classSectionSchema.safeParse(readForm(formData))
  if (!parsed.success) {
    redirectWithAdminError(
      "/admin/class-sections",
      "Class section could not be saved. Select a course and fill in the required fields."
    )
  }

  const data = parsed.data
  const { id, ...rawValues } = data

  await assertAdminScope(data)
  const prisma = getPrismaClient()
  const academicYearId =
    rawValues.academicYearId ??
    (await ensureDefaultAcademicYearForClassSection({
      campusId: rawValues.campusId,
      organizationId: rawValues.organizationId,
    }))
  const values = { ...rawValues, academicYearId }

  let redirectTo = "/admin/class-sections"
  try {
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
    redirectTo = `/admin/class-sections/${classSection.id}`
  } catch (error) {
    console.error("Class section save failed", {
      id,
      organizationId: rawValues.organizationId,
      campusId: rawValues.campusId,
      courseId: rawValues.courseId,
      error: error instanceof Error ? error.message : String(error),
    })
    redirectWithAdminError(
      "/admin/class-sections",
      "Class section could not be saved. Check that the selected organization, campus, course, and academic year belong together."
    )
  }

  redirect(redirectTo)
}

async function ensureDefaultAcademicYearForClassSection({
  campusId,
  organizationId,
}: {
  campusId: string | null
  organizationId: string
}) {
  const prisma = getPrismaClient()
  const existing = await prisma.academicYear.findFirst({
    where: {
      organizationId,
      OR: [{ campusId }, { campusId: null }],
    },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  })

  if (existing) return existing.id

  const year = new Date().getFullYear()
  const created = await prisma.academicYear.create({
    data: {
      organizationId,
      campusId,
      name: `${year}`,
      startsAt: new Date(`${year}-01-01T00:00:00.000Z`),
      endsAt: new Date(`${year}-12-31T00:00:00.000Z`),
    },
    select: { id: true },
  })

  return created.id
}

const instructorAssignmentSchema = z.object({
  classSectionId: requiredString,
  instructorId: requiredString,
  roleLabel: z.enum(["PRIMARY", "ASSISTANT", "TA"]),
})

export async function assignClassSectionInstructor(formData: FormData) {
  await assertSchoolAdminUserOnly()
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
      OR: [
        {
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
        { instructorProfile: { isNot: null } },
      ],
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

  await writeAuditLog({
    action: "class_section.instructor.assign",
    actorUserId: (await requireAdmin()).id,
    campusId: classSection.campusId,
    entityId: data.classSectionId,
    entityType: "ClassSection",
    metadata: {
      instructorId: instructor.id,
      roleLabel: data.roleLabel,
    },
    organizationId: classSection.organizationId,
    summary: `Assigned instructor to class section.`,
  })

  await revalidateAdmin("/admin/class-sections")
}

const removeInstructorAssignmentSchema = z.object({
  assignmentId: requiredString,
})

export async function removeClassSectionInstructor(formData: FormData) {
  await assertSchoolAdminUserOnly()
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
  await writeAuditLog({
    action: "class_section.instructor.remove",
    actorUserId: (await requireAdmin()).id,
    campusId: assignment.classSection.campusId,
    entityId: assignment.classSectionId,
    entityType: "ClassSection",
    metadata: {
      instructorId: assignment.instructorId,
    },
    organizationId: assignment.classSection.organizationId,
    summary: `Removed instructor from class section.`,
  })
  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${assignment.classSectionId}`)
}

const enrollmentSchema = z.object({
  classSectionId: requiredString,
  studentId: requiredString,
  status: z.nativeEnum(EnrollmentStatus),
})

export async function saveEnrollment(formData: FormData) {
  await assertSchoolAdminUserOnly()
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

  await writeAuditLog({
    action: "class_section.student.enroll",
    actorUserId: (await requireAdmin()).id,
    campusId: classSection.campusId,
    entityId: data.classSectionId,
    entityType: "ClassSection",
    metadata: {
      studentId: student.id,
      status: data.status,
    },
    organizationId: classSection.organizationId,
    summary: `Saved student enrollment.`,
  })

  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${data.classSectionId}`)
}

const removeEnrollmentSchema = z.object({
  enrollmentId: requiredString,
})

export async function removeEnrollment(formData: FormData) {
  await assertSchoolAdminUserOnly()
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
  await writeAuditLog({
    action: "class_section.student.remove",
    actorUserId: (await requireAdmin()).id,
    campusId: enrollment.classSection.campusId,
    entityId: enrollment.classSectionId,
    entityType: "ClassSection",
    metadata: {
      studentId: enrollment.studentId,
    },
    organizationId: enrollment.classSection.organizationId,
    summary: `Removed student enrollment.`,
  })
  await revalidateAdmin("/admin/class-sections")
  await revalidateAdmin(`/admin/class-sections/${enrollment.classSectionId}`)
}

const homeroomPlacementSchema = z.object({
  studentId: requiredString,
  homeroomId: requiredString,
})

export async function assignStudentToHomeroom(formData: FormData) {
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
  await assertSchoolAdminUserOnly()
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
