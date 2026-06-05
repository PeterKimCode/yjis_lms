"use client"

import { useActionState, useMemo, useState } from "react"
import { UserRole } from "@prisma/client"

import { ActionFeedback } from "@/components/action-feedback"
import { saveUserWithState } from "@/modules/admin/actions"
import { initialAdminFormState } from "@/modules/admin/form-state"
import {
  AdminSelect,
  Field,
  FormCard,
  SubmitButton,
} from "@/modules/admin/components"

type Option = { id: string; label: string }
type ScopedOption = Option & {
  organizationId: string
  campusId?: string | null
}

export type AdminUserFormValue = {
  id: string
  organizationId: string
  name: string
  email: string | null
  isActive: boolean
  studentProfile: {
    studentNumber: string | null
    admissionYear: number | null
    currentGradeLevelId: string | null
    homeroomId: string | null
  } | null
  roleAssignments: {
    role: UserRole
    organizationId: string
    campusId: string | null
  }[]
}

export function UserForm({
  organizationOptions,
  campusOptions,
  gradeLevelOptions,
  homeroomOptions,
  user,
}: {
  organizationOptions: Option[]
  campusOptions: ScopedOption[]
  gradeLevelOptions: ScopedOption[]
  homeroomOptions: ScopedOption[]
  user?: AdminUserFormValue
}) {
  const [state, formAction, pending] = useActionState(
    saveUserWithState,
    initialAdminFormState
  )
  const primaryRole = user?.roleAssignments[0]
  const [role, setRole] = useState<UserRole>(primaryRole?.role ?? UserRole.STUDENT)
  const [organizationId, setOrganizationId] = useState(
    primaryRole?.organizationId ?? user?.organizationId ?? organizationOptions[0]?.id ?? ""
  )
  const [campusId, setCampusId] = useState(primaryRole?.campusId ?? "")
  const isStudent = role === UserRole.STUDENT
  const scopedCampusOptions = useMemo(
    () => campusOptions.filter((option) => option.organizationId === organizationId),
    [campusOptions, organizationId]
  )
  const scopedGradeLevelOptions = useMemo(
    () =>
      gradeLevelOptions.filter(
        (option) =>
          option.organizationId === organizationId &&
          (!campusId || !option.campusId || option.campusId === campusId)
      ),
    [campusId, gradeLevelOptions, organizationId]
  )
  const scopedHomeroomOptions = useMemo(
    () =>
      homeroomOptions.filter(
        (option) =>
          option.organizationId === organizationId &&
          (!campusId || !option.campusId || option.campusId === campusId)
      ),
    [campusId, homeroomOptions, organizationId]
  )

  function handleOrganizationChange(value: string) {
    setOrganizationId(value)
    if (!campusOptions.some((option) => option.id === campusId && option.organizationId === value)) {
      setCampusId("")
    }
  }

  return (
    <FormCard title={user ? "Edit user" : "Create user"}>
      <div className="mb-3">
        <ActionFeedback state={state} />
      </div>
      <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <input name="id" type="hidden" value={user?.id ?? ""} />
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Organization</span>
          <select
            className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="organizationId"
            onChange={(event) => handleOrganizationChange(event.target.value)}
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
            {scopedCampusOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Field label="Name" name="name" defaultValue={user?.name} required />
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={user?.email}
          required
        />
        <Field
          label={user ? "New password" : "Password"}
          name="password"
          type="password"
          required={!user}
        />
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            {Object.values(UserRole).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {isStudent ? (
          <>
            <AdminSelect
              key={`grade-${organizationId}-${campusId}`}
              label="Student grade"
              name="currentGradeLevelId"
              options={scopedGradeLevelOptions}
              defaultValue={
                scopedGradeLevelOptions.some(
                  (option) => option.id === user?.studentProfile?.currentGradeLevelId
                )
                  ? user?.studentProfile?.currentGradeLevelId
                  : null
              }
            />
            <AdminSelect
              key={`homeroom-${organizationId}-${campusId}`}
              label="Student homeroom"
              name="homeroomId"
              options={scopedHomeroomOptions}
              defaultValue={
                scopedHomeroomOptions.some(
                  (option) => option.id === user?.studentProfile?.homeroomId
                )
                  ? user?.studentProfile?.homeroomId
                  : null
              }
            />
            <Field
              label="Student number"
              name="studentNumber"
              defaultValue={user?.studentProfile?.studentNumber}
            />
            <Field
              label="Admission year"
              name="admissionYear"
              type="number"
              defaultValue={user?.studentProfile?.admissionYear}
            />
          </>
        ) : null}
        <label className="flex items-end gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={user?.isActive ?? true}
          />
          Active
        </label>
        <div className="flex items-end">
          <SubmitButton label={pending ? "Saving..." : "Save"} />
        </div>
      </form>
    </FormCard>
  )
}
