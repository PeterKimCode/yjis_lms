import Link from "next/link"
import { notFound } from "next/navigation"
import { UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { getUserWhereForAdmin } from "@/modules/admin/access"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  Field,
  FormCard,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import {
  removeParentStudentRelation,
  saveParentStudentRelation,
} from "@/modules/admin/actions"
import { UserForm } from "@/modules/admin/user-form"

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const admin = await getAcademicSetupOptions()
  const user = await getPrismaClient().user.findFirst({
    where: {
      id: userId,
      ...getUserWhereForAdmin(admin.user),
    },
    include: {
      organization: true,
      studentProfile: {
        include: {
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
    },
  })

  if (!user) {
    notFound()
  }

  const roles = user.roleAssignments.map((assignment) => assignment.role)
  const isParent = roles.includes(UserRole.PARENT)
  const isStudent = roles.includes(UserRole.STUDENT)
  const linkedStudentIds = new Set(
    user.parentRelations.map((relation) => relation.studentId)
  )
  const linkedParentIds = new Set(
    user.studentParentRelations.map((relation) => relation.parentId)
  )
  const studentOptions = admin.studentOptions.filter(
    (option) => option.id !== user.id && !linkedStudentIds.has(option.id)
  )
  const parentOptions = admin.parentOptions.filter(
    (option) => option.id !== user.id && !linkedParentIds.has(option.id)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title={user.name}
          description="Edit the user profile, role scope, student placement, and family links."
        />
        <Button asChild variant="outline">
          <Link href="/admin/users">Back to users</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Email" value={user.email ?? "-"} />
        <SummaryItem label="Organization" value={user.organization.name} />
        <SummaryItem
          label="Roles"
          value={roles.length ? roles.join(", ") : "-"}
        />
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">Status</div>
          <div className="mt-2">
            <ActiveBadge active={user.isActive} />
          </div>
        </div>
      </div>

      <UserForm
        campusOptions={admin.campusOptions}
        gradeLevelOptions={admin.gradeLevelOptions}
        homeroomOptions={admin.homeroomOptions}
        organizationOptions={admin.organizationOptions}
        user={user}
      />

      {isParent ? (
        <ParentLinks
          parentId={user.id}
          relations={user.parentRelations}
          studentOptions={studentOptions}
        />
      ) : null}

      {isStudent ? (
        <StudentLinks
          parentOptions={parentOptions}
          relations={user.studentParentRelations}
          studentId={user.id}
        />
      ) : null}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </div>
    </div>
  )
}

function ParentLinks({
  parentId,
  relations,
  studentOptions,
}: {
  parentId: string
  relations: Array<{
    id: string
    studentId: string
    relation: string
    isPrimary: boolean
    student: {
      name: string
      email: string | null
      studentProfile: {
        currentGradeLevel: { name: string } | null
        homeroom: { name: string } | null
      } | null
    }
  }>
  studentOptions: { id: string; label: string }[]
}) {
  return (
    <FormCard title="Linked students">
      <div className="space-y-4">
        <form
          action={saveParentStudentRelation}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <input name="parentId" type="hidden" value={parentId} />
          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">Student</span>
            <select
              className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
              name="studentId"
              required
            >
              <option value="">
                {studentOptions.length ? "Select student" : "No available students"}
              </option>
              {studentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Relation" name="relation" defaultValue="Guardian" />
          <label className="flex items-end gap-2 text-sm">
            <input name="isPrimary" type="checkbox" />
            Primary
          </label>
          <div className="flex items-end">
            <SubmitButton label="Link student" />
          </div>
        </form>

        <DataTable
          empty="No students are linked to this parent yet."
          headers={["Student", "Email", "Placement", "Relation", "Primary", "Actions"]}
          minWidth="min-w-[760px]"
          rows={relations.map((relation) => (
            <TableRow key={relation.id}>
              <TableCell className="font-medium">{relation.student.name}</TableCell>
              <TableCell>{relation.student.email ?? "-"}</TableCell>
              <TableCell>
                {[
                  relation.student.studentProfile?.currentGradeLevel?.name,
                  relation.student.studentProfile?.homeroom?.name,
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </TableCell>
              <TableCell>{relation.relation}</TableCell>
              <TableCell>{relation.isPrimary ? "Yes" : "No"}</TableCell>
              <TableCell>
                <form action={removeParentStudentRelation}>
                  <input name="relationId" type="hidden" value={relation.id} />
                  <Button size="sm" type="submit" variant="destructive">
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        />
      </div>
    </FormCard>
  )
}

function StudentLinks({
  studentId,
  relations,
  parentOptions,
}: {
  studentId: string
  relations: Array<{
    id: string
    parentId: string
    relation: string
    isPrimary: boolean
    parent: {
      name: string
      email: string | null
    }
  }>
  parentOptions: { id: string; label: string }[]
}) {
  return (
    <FormCard title="Linked parents">
      <div className="space-y-4">
        <form
          action={saveParentStudentRelation}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <input name="studentId" type="hidden" value={studentId} />
          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">Parent</span>
            <select
              className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
              name="parentId"
              required
            >
              <option value="">
                {parentOptions.length ? "Select parent" : "No available parents"}
              </option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Relation" name="relation" defaultValue="Guardian" />
          <label className="flex items-end gap-2 text-sm">
            <input name="isPrimary" type="checkbox" />
            Primary
          </label>
          <div className="flex items-end">
            <SubmitButton label="Link parent" />
          </div>
        </form>

        <DataTable
          empty="No parents are linked to this student yet."
          headers={["Parent", "Email", "Relation", "Primary", "Actions"]}
          minWidth="min-w-[680px]"
          rows={relations.map((relation) => (
            <TableRow key={relation.id}>
              <TableCell className="font-medium">{relation.parent.name}</TableCell>
              <TableCell>{relation.parent.email ?? "-"}</TableCell>
              <TableCell>{relation.relation}</TableCell>
              <TableCell>{relation.isPrimary ? "Yes" : "No"}</TableCell>
              <TableCell>
                <form action={removeParentStudentRelation}>
                  <input name="relationId" type="hidden" value={relation.id} />
                  <Button size="sm" type="submit" variant="destructive">
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        />
      </div>
    </FormCard>
  )
}
