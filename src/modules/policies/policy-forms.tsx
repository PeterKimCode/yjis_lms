"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  initialPolicyActionState,
  type PolicyActionState,
} from "@/modules/policies/action-state"
import {
  saveAttendancePolicy,
  saveGradingAndDocumentPolicy,
  saveVideoCompletionPolicy,
} from "@/modules/policies/actions"
import type { ResolvedPolicies } from "@/modules/policies/types"

type Option = { id: string; label: string }

export function PolicyForms({
  campusId,
  campusOptions,
  organizationId,
  organizationOptions,
  policies,
}: {
  campusId: string | null
  campusOptions: Option[]
  organizationId: string
  organizationOptions: Option[]
  policies: ResolvedPolicies
}) {
  return (
    <div className="space-y-4">
      <details className="rounded-lg border bg-background p-4" open>
        <summary className="cursor-pointer font-medium">Attendance policy</summary>
        <div className="pt-4">
          <AttendancePolicyForm
            campusId={campusId}
            campusOptions={campusOptions}
            organizationId={organizationId}
            organizationOptions={organizationOptions}
            policies={policies}
          />
        </div>
      </details>
      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer font-medium">
          Video completion policy
        </summary>
        <div className="pt-4">
          <VideoPolicyForm
            campusId={campusId}
            campusOptions={campusOptions}
            organizationId={organizationId}
            organizationOptions={organizationOptions}
            policies={policies}
          />
        </div>
      </details>
      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer font-medium">
          Assignments, grades, GPA, and documents
        </summary>
        <div className="pt-4">
          <GradingPolicyForm
            campusId={campusId}
            campusOptions={campusOptions}
            organizationId={organizationId}
            organizationOptions={organizationOptions}
            policies={policies}
          />
        </div>
      </details>
    </div>
  )
}

function AttendancePolicyForm({
  campusId,
  campusOptions,
  organizationId,
  organizationOptions,
  policies,
}: SharedProps) {
  const [state, formAction, pending] = useActionState(
    saveAttendancePolicy,
    initialPolicyActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ContextFields
        campusId={campusId}
        campusOptions={campusOptions}
        organizationId={organizationId}
        organizationOptions={organizationOptions}
      />
      <NumberField
        help="Minutes after session start before a student is marked late."
        label="Late threshold (minutes)"
        min="0"
        name="lateThresholdMinutes"
        step="1"
        value={policies.attendance.lateThresholdMinutes}
      />
      <NumberField
        help="Optional attendance danger threshold for reporting."
        label="Absence fail threshold (%)"
        max="100"
        min="0"
        name="absenceFailThresholdRate"
        step="1"
        value={policies.attendance.absenceFailThresholdRate ?? ""}
      />
      <NumberField
        help="If late counts as absence, this controls how much one late record reduces attendance."
        label="Late absence equivalent"
        max="1"
        min="0"
        name="lateEquivalentAbsenceCount"
        step="0.1"
        value={policies.attendance.lateEquivalentAbsenceCount}
      />
      <CheckField
        checked={policies.attendance.countLateAsAbsence}
        help="If enabled, late records can reduce attendance like absences."
        label="Late counts as absence"
        name="countLateAsAbsence"
      />
      <CheckField
        checked={policies.attendance.excusedCountsAsPresent}
        help="Excused, sick, and official absences count as full attendance credit."
        label="Excused counts as present"
        name="excusedCountsAsPresent"
      />
      <CheckField
        checked={policies.attendance.excusedCountsAgainstAttendance}
        help="If disabled, excused records are ignored in the attendance denominator."
        label="Excused counts in attendance rate"
        name="excusedCountsAgainstAttendance"
      />
      <CheckField
        checked={policies.attendance.allowInstructorOverride}
        help="Allow instructors to manually edit attendance records."
        label="Allow instructor override"
        name="allowInstructorOverride"
      />
      <FormFooter pending={pending} state={state} />
    </form>
  )
}

function VideoPolicyForm({
  campusId,
  campusOptions,
  organizationId,
  organizationOptions,
  policies,
}: SharedProps) {
  const [state, formAction, pending] = useActionState(
    saveVideoCompletionPolicy,
    initialPolicyActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ContextFields
        campusId={campusId}
        campusOptions={campusOptions}
        organizationId={organizationId}
        organizationOptions={organizationOptions}
      />
      <NumberField
        help="Percentage of actual watched video required to mark a lesson complete."
        label="Completion threshold (%)"
        max="100"
        min="1"
        name="completionThresholdPercent"
        step="1"
        value={policies.videoCompletion.completionThresholdPercent}
      />
      <NumberField
        help="Optional minimum watch time before completion can be granted."
        label="Minimum watch seconds"
        min="0"
        name="minimumWatchSeconds"
        step="1"
        value={policies.videoCompletion.minimumWatchSeconds ?? ""}
      />
      <CheckField
        checked={policies.videoCompletion.requireActualWatchedCoverage}
        help="Seeking to the end does not count as completion."
        label="Require actual watched coverage"
        name="requireActualWatchedCoverage"
      />
      <FormFooter pending={pending} state={state} />
    </form>
  )
}

function GradingPolicyForm({
  campusId,
  campusOptions,
  organizationId,
  organizationOptions,
  policies,
}: SharedProps) {
  const [state, formAction, pending] = useActionState(
    saveGradingAndDocumentPolicy,
    initialPolicyActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ContextFields
        campusId={campusId}
        campusOptions={campusOptions}
        organizationId={organizationId}
        organizationOptions={organizationOptions}
      />
      <CheckField
        checked={policies.assignment.allowLateSubmissionDefault}
        help="Default for new assignments. Instructors can still override per assignment."
        label="Allow late submissions by default"
        name="allowLateSubmissionDefault"
      />
      <CheckField
        checked={policies.assignment.allowResubmissionBeforeDue}
        help="Students can update submissions before the due date."
        label="Allow resubmission before due"
        name="allowResubmissionBeforeDue"
      />
      <NumberField
        help="MVP stores this setting; automatic penalty application can be expanded later."
        label="Late penalty (%)"
        max="100"
        min="0"
        name="latePenaltyPercent"
        step="1"
        value={policies.assignment.latePenaltyPercent}
      />
      <NumberField
        help="Optional maximum number of late days."
        label="Maximum late days"
        min="0"
        name="maxLateDays"
        step="1"
        value={policies.assignment.maxLateDays ?? ""}
      />
      <CheckField
        checked={policies.gradeVisibility.studentsCanSeeDraftGrades}
        help="Keep disabled for MVP unless draft grade previews are intentional."
        label="Students can see draft grades"
        name="studentsCanSeeDraftGrades"
      />
      <CheckField
        checked={policies.gradeVisibility.parentsCanSeeDraftGrades}
        help="Keep disabled for MVP unless draft grade previews are intentional."
        label="Parents can see draft grades"
        name="parentsCanSeeDraftGrades"
      />
      <CheckField
        checked={policies.gradeVisibility.showAssignmentFeedbackBeforeFinalGrade}
        help="Allow graded assignment feedback before final grades are published."
        label="Show assignment feedback before final grade"
        name="showAssignmentFeedbackBeforeFinalGrade"
      />
      <CheckField
        checked={policies.gradeVisibility.showQuizResultsImmediately}
        help="Allow quiz results when the quiz itself allows results."
        label="Show quiz results immediately"
        name="showQuizResultsImmediately"
      />
      <CheckField
        checked={policies.document.reportCardsRequirePublishedGrades}
        help="Student and parent report card downloads require published/finalized grades."
        label="Report cards require published grades"
        name="reportCardsRequirePublishedGrades"
      />
      <CheckField
        checked={policies.document.transcriptsRequirePublishedGrades}
        help="Student and parent transcript downloads require published/finalized grades."
        label="Transcripts require published grades"
        name="transcriptsRequirePublishedGrades"
      />
      <NumberField
        help="Used as the displayed GPA scale policy. Grade conversion uses the selected grading scale below."
        label="GPA scale"
        max="10"
        min="0"
        name="gpaScale"
        step="0.1"
        value="4.5"
      />
      <FormFooter pending={pending} state={state} />
    </form>
  )
}

type SharedProps = {
  campusId: string | null
  campusOptions: Option[]
  organizationId: string
  organizationOptions: Option[]
  policies: ResolvedPolicies
}

function ContextFields({
  campusId,
  campusOptions,
  organizationId,
  organizationOptions,
}: Omit<SharedProps, "policies">) {
  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Organization</span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="organizationId"
          defaultValue={organizationId}
          required
        >
          {organizationOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Campus</span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="campusId"
          defaultValue={campusId ?? ""}
        >
          <option value="">Organization default</option>
          {campusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

function NumberField({
  help,
  label,
  max,
  min,
  name,
  step,
  value,
}: {
  help: string
  label: string
  max?: string
  min: string
  name: string
  step: string
  value: string | number
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        inputMode="decimal"
        max={max}
        min={min}
        name={name}
        step={step}
        type="number"
        defaultValue={value}
      />
      <span className="text-xs text-muted-foreground">{help}</span>
    </label>
  )
}

function CheckField({
  checked,
  help,
  label,
  name,
}: {
  checked: boolean
  help: string
  label: string
  name: string
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
      <input
        className="mt-1"
        name={name}
        type="checkbox"
        defaultChecked={checked}
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{help}</span>
      </span>
    </label>
  )
}

function FormFooter({
  pending,
  state,
}: {
  pending: boolean
  state: PolicyActionState
}) {
  return (
    <div className="flex flex-col justify-end gap-2">
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save policy"}
      </Button>
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  )
}

