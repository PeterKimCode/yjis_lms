"use client"

import { useMemo, useState } from "react"
import { DeliveryMode } from "@prisma/client"

import { saveClassSection } from "@/modules/admin/actions"
import {
  AdminSelect,
  Field,
  FormCard,
  SubmitButton,
} from "@/modules/admin/components"

type SelectOption = {
  id: string
  label: string
}

type CourseOption = SelectOption & {
  campusId: string | null
  code: string | null
  defaultDeliveryMode: DeliveryMode
  organizationId: string
  title: string
}

type ClassSectionFormValue = {
  academicYearId?: string | null
  campusId?: string | null
  capacity?: number | null
  courseId?: string | null
  deliveryMode?: DeliveryMode | null
  gradeLevelId?: string | null
  homeroomId?: string | null
  id?: string | null
  name?: string | null
  organizationId?: string | null
  sectionCode?: string | null
  termId?: string | null
}

export function ClassSectionClientForm({
  academicYearOptions,
  campusOptions,
  courseOptions,
  gradeLevelOptions,
  homeroomOptions,
  organizationOptions,
  section,
  termOptions,
}: {
  academicYearOptions: SelectOption[]
  campusOptions: SelectOption[]
  courseOptions: CourseOption[]
  gradeLevelOptions: SelectOption[]
  homeroomOptions: SelectOption[]
  organizationOptions: SelectOption[]
  section?: ClassSectionFormValue
  termOptions: SelectOption[]
}) {
  const initialCourse = useMemo(
    () => courseOptions.find((course) => course.id === section?.courseId),
    [courseOptions, section?.courseId]
  )
  const [organizationId, setOrganizationId] = useState(
    section?.organizationId ?? initialCourse?.organizationId ?? ""
  )
  const [campusId, setCampusId] = useState(
    section?.campusId ?? initialCourse?.campusId ?? ""
  )
  const [courseId, setCourseId] = useState(section?.courseId ?? "")
  const [deliveryMode, setDeliveryMode] = useState(
    section?.deliveryMode ?? initialCourse?.defaultDeliveryMode ?? DeliveryMode.OFFLINE
  )
  const [name, setName] = useState(section?.name ?? initialCourse?.title ?? "")
  const [sectionCode, setSectionCode] = useState(
    section?.sectionCode ?? initialCourse?.code ?? ""
  )

  function handleCourseChange(nextCourseId: string) {
    setCourseId(nextCourseId)
    const course = courseOptions.find((item) => item.id === nextCourseId)
    if (!course) return

    setOrganizationId(course.organizationId)
    setCampusId(course.campusId ?? "")
    setDeliveryMode(course.defaultDeliveryMode)
    setName(course.title)
    setSectionCode(course.code ?? "")
  }

  return (
    <FormCard title={section ? "Edit class section" : "Create class section"}>
      <form
        action={saveClassSection}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <input name="id" type="hidden" value={section?.id ?? ""} />
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Organization</span>
          <select
            className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="organizationId"
            onChange={(event) => setOrganizationId(event.target.value)}
            required
            value={organizationId}
          >
            {organizationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Campus</span>
          <select
            className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="campusId"
            onChange={(event) => setCampusId(event.target.value)}
            value={campusId}
          >
            <option value="">None</option>
            {campusOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <AdminSelect
          includeEmpty={false}
          label="Academic year"
          name="academicYearId"
          options={academicYearOptions}
          defaultValue={section?.academicYearId}
          required
        />
        <AdminSelect
          label="Term"
          name="termId"
          options={termOptions}
          defaultValue={section?.termId}
        />
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Course</span>
          <select
            className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="courseId"
            onChange={(event) => handleCourseChange(event.target.value)}
            required
            value={courseId}
          >
            <option value="" disabled>
              Select a course
            </option>
            {courseOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Selecting a course fills organization, campus, title, section code,
            and delivery mode.
          </span>
        </label>
        <AdminSelect
          label="Grade level"
          name="gradeLevelId"
          options={gradeLevelOptions}
          defaultValue={section?.gradeLevelId}
        />
        <AdminSelect
          label="Homeroom"
          name="homeroomId"
          options={homeroomOptions}
          defaultValue={section?.homeroomId}
        />
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            className="h-8 rounded-lg border border-input bg-background px-3 text-sm"
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Section code</span>
          <input
            className="h-8 rounded-lg border border-input bg-background px-3 text-sm"
            name="sectionCode"
            onChange={(event) => setSectionCode(event.target.value)}
            value={sectionCode}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Delivery mode</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="deliveryMode"
            onChange={(event) => setDeliveryMode(event.target.value as DeliveryMode)}
            value={deliveryMode}
          >
            {Object.values(DeliveryMode).map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Capacity (max students)"
          name="capacity"
          type="number"
          defaultValue={section?.capacity}
          placeholder="Example: 24"
        />
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
