import { Button } from "@/components/ui/button"
import {
  AdminPageHeader,
  DataTable,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getPolicyAdminData } from "@/modules/policies/admin-data"
import { PolicyForms } from "@/modules/policies/policy-forms"
import type { ResolvedPolicies } from "@/modules/policies/types"

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ campusId?: string; organizationId?: string }>
}) {
  const params = await searchParams
  const data = await getPolicyAdminData({
    campusId: params.campusId ?? null,
    organizationId: params.organizationId ?? null,
  })

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

  const organization = data.organizations.find(
    (item) => item.id === data.selectedOrganizationId
  )
  const campus = data.campuses.find((item) => item.id === data.selectedCampusId)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Policies"
        description="Configure school-level rules for attendance, video completion, assignments, grades, GPA, and documents."
      />
      <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
        If a campus-specific policy is missing, the system falls back to the
        organization default, then safe system defaults. You are editing the
        effective values for the selected scope below.
      </p>
      <ScopeSelector data={data} />
      <p className="text-sm font-medium">
        {campus
          ? `Editing policies for: ${campus.name}`
          : `Editing organization default policies: ${organization?.name ?? "Unknown organization"}`}
      </p>
      <PolicySummary data={data} />
      <PolicyForms
        campusId={data.selectedCampusId}
        organizationId={data.selectedOrganizationId}
        policies={data.policies}
      />
      <GradingScaleSection data={data} />
    </div>
  )
}

function ScopeSelector({
  data,
}: {
  data: Awaited<ReturnType<typeof getPolicyAdminData>>
}) {
  return (
    <form
      action="/admin/policies"
      className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-3"
    >
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Organization</span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="organizationId"
          defaultValue={data.selectedOrganizationId ?? ""}
          required
        >
          {data.organizationOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Choose the organization policy scope.
        </span>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Campus</span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="campusId"
          defaultValue={data.selectedCampusId ?? ""}
        >
          <option value="">None / Organization default</option>
          {data.scopedCampusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Select a campus override or leave blank for the organization default.
        </span>
      </label>
      <div className="flex items-end">
        <Button size="sm" type="submit" variant="outline">
          Change scope
        </Button>
      </div>
    </form>
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
  const scale = data.policies?.gradingScale

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="Scope"
        value={
          campus
            ? `${campus.name} campus override`
            : `${organization?.name ?? "Organization"} default`
        }
      />
      <SummaryCard
        label="Attendance"
        value={`Late after ${data.policies?.attendance.lateThresholdMinutes} min · Late as absence: ${
          data.policies?.attendance.countLateAsAbsence ? "Yes" : "No"
        }`}
      />
      <SummaryCard
        label="Video completion"
        value={`Complete at ${data.policies?.videoCompletion.completionThresholdPercent}%`}
      />
      <SummaryCard
        label="Assignments"
        value={`Late submissions: ${
          data.policies?.assignment.allowLateSubmissionDefault
            ? "Default yes"
            : "Default no"
        }`}
      />
      <SummaryCard
        label="Grades"
        value={
          data.policies?.gradeVisibility.studentsCanSeeDraftGrades ||
          data.policies?.gradeVisibility.parentsCanSeeDraftGrades
            ? "Draft visibility enabled"
            : "Draft hidden from students/parents"
        }
      />
      <SummaryCard
        label="Documents"
        value={
          data.policies?.document.reportCardsRequirePublishedGrades
            ? "Visible after published grades"
            : "Draft downloads allowed by policy"
        }
      />
      <SummaryCard
        label="GPA / grading scale"
        value={`${scale?.name ?? "No scale"} · max ${getMaxGradePoint(scale)}`}
      />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-semibold" title={value}>
        {value}
      </div>
    </div>
  )
}

function GradingScaleSection({
  data,
}: {
  data: Awaited<ReturnType<typeof getPolicyAdminData>>
}) {
  return (
    <details className="rounded-lg border bg-background p-4" open>
      <summary className="cursor-pointer font-medium">
        Grading scale / GPA policy
      </summary>
      <div className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Final numeric scores are converted to letter grades and GPA points
          using this table. Scale editing is intentionally read-only for the MVP;
          a validated editor can be added later.
        </p>
        {data.gradingScales.map((scale) => (
          <div className="space-y-2" key={scale.id}>
            <div>
              <p className="font-medium">
                Current scale: {scale.name} {scale.isDefault ? "(default)" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                Maximum GPA: {getMaxGradePoint(scale)}.{" "}
                {scale.description ?? "No description."}
              </p>
            </div>
            <DataTable
              empty="No grading scale items configured."
              headers={["Letter grade", "Min score", "Max score", "Grade point", "Passing"]}
              minWidth="min-w-[620px]"
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
  )
}

function getMaxGradePoint(scale: ResolvedPolicies["gradingScale"] | undefined) {
  if (!scale?.items.length) return "-"

  return scale.items
    .reduce((max, item) => {
      const value = Number(item.gradePoint ?? 0)
      return value > max ? value : max
    }, 0)
    .toFixed(1)
}
