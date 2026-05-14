"use server"

import { revalidatePath } from "next/cache"
import { DeliveryMode } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { assertAdminScope } from "@/modules/admin/access"

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
