import { AdminPageHeader, DataTable, TableCell, TableRow } from "@/modules/admin/components"
import { getPolicyAdminData } from "@/modules/policies/admin-data"
import { PolicyForms } from "@/modules/policies/policy-forms"

export default async function PoliciesPage() {
  const data = await getPolicyAdminData()

  if (!data.selectedOrganizationId || !data.policies) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Policies"
          description="Configure school-level rules for attendance, video completion, assignments, grades, GPA, and documents."
        />
        <p className="text-sm text-muted-foreground">
          Create an organization before configuring policies.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Policies"
        description="Configure school-level rules for attendance, video completion, assignments, grades, GPA, and documents."
      />
      <PolicySummary data={data} />
      <PolicyForms
        campusId={data.selectedCampusId}
        campusOptions={data.campusOptions}
        organizationId={data.selectedOrganizationId}
        organizationOptions={data.organizationOptions}
        policies={data.policies}
      />
      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer font-medium">
          Grading scale / GPA policy
        </summary>
        <div className="space-y-4 pt-4">
          {data.gradingScales.map((scale) => (
            <div className="space-y-2" key={scale.id}>
              <div>
                <p className="font-medium">
                  {scale.name} {scale.isDefault ? "(default)" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {scale.description ?? "No description."}
                </p>
              </div>
              <DataTable
                empty="No grading scale items configured."
                headers={["Letter", "Min", "Max", "Grade point", "Passing"]}
                minWidth="min-w-[520px]"
                rows={scale.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell>{item.minPercentage.toString()}</TableCell>
                    <TableCell>{item.maxPercentage.toString()}</TableCell>
                    <TableCell>{item.gradePoint?.toString() ?? "-"}</TableCell>
                    <TableCell>
                      {item.gradePoint && item.gradePoint.gt(0) ? "Yes" : "No"}
                    </TableCell>
                  </TableRow>
                ))}
              />
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

function PolicySummary({
  data,
}: {
  data: Awaited<ReturnType<typeof getPolicyAdminData>>
}) {
  const campus = data.campuses.find((item) => item.id === data.selectedCampusId)
  const organization = data.organizations.find(
    (item) => item.id === data.selectedOrganizationId
  )

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border bg-background p-4">
        <div className="text-xs text-muted-foreground">Selected scope</div>
        <div className="font-semibold">
          {campus ? `${campus.name} (${campus.organization.name})` : organization?.name}
        </div>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <div className="text-xs text-muted-foreground">Attendance late threshold</div>
        <div className="font-semibold">
          {data.policies?.attendance.lateThresholdMinutes} minutes
        </div>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <div className="text-xs text-muted-foreground">Video completion</div>
        <div className="font-semibold">
          {data.policies?.videoCompletion.completionThresholdPercent}%
        </div>
      </div>
    </div>
  )
}

