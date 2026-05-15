"use client"

import { useState } from "react"
import { UserRole } from "@prisma/client"

import { saveUser } from "@/modules/admin/actions"
import {
  AdminSelect,
  Field,
  FormCard,
  SubmitButton,
} from "@/modules/admin/components"

type Option = { id: string; label: string }

export type AdminUserFormValue = {
  id: string
  organizationId: string
  name: string
  email: string | null
  isActive: boolean
  studentProfile: {
    studentNumber: string | null
    admissionDate: Date | null
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
  campusOptions: Option[]
  gradeLevelOptions: Option[]
  homeroomOptions: Option[]
  user?: AdminUserFormValue
}) {
  const primaryRole = user?.roleAssignments[0]
  const [role, setRole] = useState<UserRole>(primaryRole?.role ?? UserRole.STUDENT)
  const isStudent = role === UserRole.STUDENT

  return (
    <FormCard title={user ? "Edit user" : "Create user"}>
      <form action={saveUser} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <input name="id" type="hidden" value={user?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={organizationOptions}
          defaultValue={primaryRole?.organizationId ?? user?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={campusOptions}
          defaultValue={primaryRole?.campusId}
        />
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
              label="Student grade"
              name="currentGradeLevelId"
              options={gradeLevelOptions}
              defaultValue={user?.studentProfile?.currentGradeLevelId}
            />
            <AdminSelect
              label="Student homeroom"
              name="homeroomId"
              options={homeroomOptions}
              defaultValue={user?.studentProfile?.homeroomId}
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
              defaultValue={user?.studentProfile?.admissionDate?.getUTCFullYear()}
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
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
