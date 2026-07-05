"use client"

import { DeliveryMode } from "@prisma/client"
import { useActionState, useMemo, useState } from "react"

import { ActionFeedback } from "@/components/action-feedback"
import { saveCourseWithState } from "@/modules/admin/actions"
import { Field, FormCard, SubmitButton } from "@/modules/admin/components"
import { initialAdminFormState } from "@/modules/admin/form-state"

type Option = { id: string; label: string }
type ScopedOption = Option & {
  organizationId: string
  campusId?: string | null
}

export type CourseFormData = {
  organizationOptions: Option[]
  campusOptions: ScopedOption[]
  departmentOptions: ScopedOption[]
}

export type CourseFormValue = {
  id: string
  organizationId: string
  campusId: string | null
  departmentId: string | null
  code: string | null
  title: string
  description: string | null
  credits: string
  defaultDeliveryMode: DeliveryMode
}

export function CourseForm({
  data,
  course,
}: {
  data: CourseFormData
  course?: CourseFormValue
}) {
  const [state, formAction, pending] = useActionState(
    saveCourseWithState,
    initialAdminFormState
  )
  const [organizationId, setOrganizationId] = useState(
    course?.organizationId ?? data.organizationOptions[0]?.id ?? ""
  )
  const [campusId, setCampusId] = useState(course?.campusId ?? "")

  const campusOptions = useMemo(
    () =>
      data.campusOptions.filter(
        (option) => option.organizationId === organizationId
      ),
    [data.campusOptions, organizationId]
  )
  const departmentOptions = useMemo(
    () =>
      data.departmentOptions.filter(
        (option) =>
          option.organizationId === organizationId &&
          (!campusId || !option.campusId || option.campusId === campusId)
      ),
    [campusId, data.departmentOptions, organizationId]
  )
  function handleOrganizationChange(value: string) {
    setOrganizationId(value)
    if (
      !data.campusOptions.some(
        (option) => option.id === campusId && option.organizationId === value
      )
    ) {
      setCampusId("")
    }
  }

  const form = (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={course?.id ?? ""} />
      <div className="sm:col-span-2 xl:col-span-4">
        <ActionFeedback closeOnSuccess={Boolean(course)} state={state} />
      </div>
      <label className="grid min-w-0 gap-1 text-sm">
        <span className="font-medium">Organization</span>
        <select
          className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
          name="organizationId"
          onChange={(event) => handleOrganizationChange(event.target.value)}
          required
          value={organizationId}
        >
          {data.organizationOptions.map((option) => (
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
          <option value="">None / Organization-wide</option>
          {campusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm">
        <span className="font-medium">Department</span>
        <select
          className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
          name="departmentId"
          defaultValue={
            departmentOptions.some((option) => option.id === course?.departmentId)
              ? course?.departmentId ?? ""
              : ""
          }
          key={`${organizationId}-${campusId}-${course?.departmentId ?? "new"}`}
        >
          <option value="">None</option>
          {departmentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Field label="Code" name="code" defaultValue={course?.code} />
      <Field label="Title" name="title" defaultValue={course?.title} required />
      <Field
        label="Credits"
        name="credits"
        type="number"
        defaultValue={course?.credits ?? ""}
      />
      <label className="grid min-w-0 gap-1 text-sm">
        <span className="font-medium">Default delivery</span>
        <select
          className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
          name="defaultDeliveryMode"
          defaultValue={course?.defaultDeliveryMode ?? DeliveryMode.OFFLINE}
        >
          {Object.values(DeliveryMode).map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Description"
        name="description"
        defaultValue={course?.description}
      />
      <div className="flex items-end">
        <SubmitButton label={pending ? "Saving..." : "Save"} />
      </div>
    </form>
  )

  return course ? form : <FormCard title="Create course">{form}</FormCard>
}
