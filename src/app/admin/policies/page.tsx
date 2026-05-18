import { AdminPageHeader } from "@/modules/admin/components"
import { getPolicyAdminData } from "@/modules/policies/admin-data"
import { GradingScaleEditor } from "@/modules/policies/grading-scale-editor"
import { PolicyForms } from "@/modules/policies/policy-forms"
import { PolicyScopeSelector } from "@/modules/policies/scope-selector"
import type { SerializedGradingScale } from "@/modules/policies/types"

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

  if (!data.selectedOrganizationId || !data.policyFormValue) {
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
      <PolicyScopeSelector
        campusOptions={data.policyCampusOptions}
        organizationOptions={data.organizationOptions}
        selectedCampusId={data.selectedCampusId}
        selectedOrganizationId={data.selectedOrganizationId}
      />
      <p className="text-sm font-medium">
        {campus
          ? `Editing campus policies: ${campus.name} (${campus.organization.name})`
          : `Editing organization default policies: ${organization?.name ?? "Unknown organization"}`}
      </p>
      <PolicySummary data={data} />
      <PolicyForms
        campusId={data.selectedCampusId}
        organizationId={data.selectedOrganizationId}
        policies={data.policyFormValue}
      />
      <GradingScaleSection data={data} />
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
  const scale = data.gradingScales[0]

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
        value={`Late after ${data.policyFormValue?.attendance.lateThresholdMinutes} min - Late as absence: ${
          data.policyFormValue?.attendance.countLateAsAbsence ? "Yes" : "No"
        }`}
      />
      <SummaryCard
        label="Video completion"
        value={`Complete at ${data.policyFormValue?.videoCompletion.completionThresholdPercent}%`}
      />
      <SummaryCard
        label="Assignments"
        value={`Late submissions: ${
          data.policyFormValue?.assignment.allowLateSubmissionDefault
            ? "Default yes"
            : "Default no"
        }`}
      />
      <SummaryCard
        label="Grades"
        value={
          data.policyFormValue?.gradeVisibility.studentsCanSeeDraftGrades ||
          data.policyFormValue?.gradeVisibility.parentsCanSeeDraftGrades
            ? "Draft visibility enabled"
            : "Draft hidden from students/parents"
        }
      />
      <SummaryCard
        label="Documents"
        value={
          data.policyFormValue?.document.reportCardsRequirePublishedGrades
            ? "Visible after published grades"
            : "Draft downloads allowed by policy"
        }
      />
      <SummaryCard
        label="GPA / grading scale"
        value={
          scale
            ? `${scale.name} - max ${getMaxGradePoint(scale)} - ${scale.items.length} rows`
            : "No scale"
        }
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
          using this table.
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
            <GradingScaleEditor
              organizationId={data.selectedOrganizationId ?? ""}
              scale={scale}
            />
          </div>
        ))}
      </div>
    </details>
  )
}

function getMaxGradePoint(scale: SerializedGradingScale | undefined) {
  if (!scale?.items.length) return "-"

  return scale.items
    .reduce((max, item) => {
      const value = Number(item.gradePoint)
      return value > max ? value : max
    }, 0)
    .toFixed(1)
}

