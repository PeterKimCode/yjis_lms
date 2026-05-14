"use server"

import { revalidatePath } from "next/cache"
import { DeliveryMode, InstitutionType, UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { assertAdminScope, requireAdmin } from "@/modules/admin/access"
import { hashPassword } from "@/modules/auth/password"

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))

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
  await getPrismaClient().campus.upsert({
    where: { id: maybeId(id) ?? "__new_campus__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/campuses")
}

const userSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  name: requiredString,
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().optional().default(""),
  role: z.nativeEnum(UserRole),
  isActive: checkboxBoolean,
})

export async function saveUser(formData: FormData) {
  const data = userSchema.parse({
    ...readForm(formData),
    isActive: formData.get("isActive"),
  })
  const { id, password, role, campusId, ...userValues } = data

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

  await revalidateAdmin("/admin/users")
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
  await getPrismaClient().classSection.upsert({
    where: { id: maybeId(id) ?? "__new_class_section__" },
    update: values,
    create: values,
  })
  await revalidateAdmin("/admin/class-sections")
}
