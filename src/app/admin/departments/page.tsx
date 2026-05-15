import { saveDepartment } from "@/modules/admin/actions"
import {
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Field,
  FormCard,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const q = (await searchParams).q?.trim() ?? ""
  const departments = data.departments.filter((department) =>
    matchesSearch(q, [
      department.name,
      department.code,
      department.campus?.name,
      department.organization.name,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Departments"
        description="Define university or academy departments for course ownership."
      />
      <SearchForm q={q} placeholder="Search departments..." />
      <DepartmentForm data={data} />
      <DataTable
        empty="No departments yet."
        headers={["Name", "Code", "Campus", "Edit"]}
        rows={departments.map((department) => (
          <TableRow key={department.id}>
            <TableCell className="font-medium">{department.name}</TableCell>
            <TableCell>{department.code ?? "-"}</TableCell>
            <TableCell>
              {data.campuses.find((campus) => campus.id === department.campusId)
                ?.name ?? "All campuses"}
            </TableCell>
            <TableCell>
              <DepartmentForm data={data} department={department} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function DepartmentForm({
  data,
  department,
}: {
  data: Awaited<ReturnType<typeof getAcademicSetupOptions>>
  department?: {
    id: string
    organizationId: string
    campusId: string | null
    name: string
    code: string | null
  }
}) {
  return (
    <FormCard title={department ? "Edit department" : "Create department"}>
      <form action={saveDepartment} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input name="id" type="hidden" value={department?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={data.organizationOptions}
          defaultValue={department?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={data.campusOptions}
          defaultValue={department?.campusId}
        />
        <Field
          label="Name"
          name="name"
          defaultValue={department?.name}
          required
        />
        <Field label="Code" name="code" defaultValue={department?.code} />
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
