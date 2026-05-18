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

export function PolicyForms({
  campusId,
  organizationId,
  policies,
}: {
  campusId: string | null
  organizationId: string
  policies: ResolvedPolicies
}) {
  return (
    <div className="space-y-4">
      <details className="rounded-lg border bg-background p-4" open>
        <summary className="cursor-pointer font-medium">Attendance policy</summary>
        <div className="pt-4">
          <AttendancePolicyForm
            campusId={campusId}
            organizationId={organizationId}
            policies={policies}
          />
        </div>
      </details>
      <details className="rounded-lg border bg-background p-4" open>
        <summary className="cursor-pointer font-medium">
          Video completion policy
        </summary>
        <div className="pt-4">
          <VideoPolicyForm
            campusId={campusId}
            organizationId={organizationId}
            policies={policies}
          />
        </div>
      </details>
      <details className="rounded-lg border bg-background p-4" open>
        <summary className="cursor-pointer font-medium">
          Assignments, grades, GPA, and documents
        </summary>
        <div className="pt-4">
          <GradingPolicyForm
            campusId={campusId}
            organizationId={organizationId}
            policies={policies}
          />
        </div>
      </details>
    </div>
  )
}

function AttendancePolicyForm({
  campusId,
  organizationId,
  policies,
}: SharedProps) {
  const [state, formAction, pending] = useActionState(
    saveAttendancePolicy,
    initialPolicyActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ContextFields campusId={campusId} organizationId={organizationId} />
      <NumberField
        help="A student is late if they are marked after this many minutes from class start. Default: 10 minutes."
        label="Late threshold (minutes)"
        min="0"
        name="lateThresholdMinutes"
        step="1"
        value={policies.attendance.lateThresholdMinutes}
      />
      <NumberField
        help="Optional warning/fail threshold based on absence rate. Example: 30 means a student is flagged if absences reach 30% of attendance-counted sessions."
        label="Absence fail threshold (%)"
        max="100"
        min="0"
        name="absenceFailThresholdRate"
        step="1"
        value={policies.attendance.absenceFailThresholdRate ?? ""}
      />
      <NumberField
        help="How much one late record counts as an absence when Late counts as absence is enabled. Example: 0.5 means two late records count as one absence. 0 means lates do not count as absences."
        label="Late-to-absence conversion"
        max="1"
        min="0"
        name="lateEquivalentAbsenceCount"
        step="0.1"
        value={policies.attendance.lateEquivalentAbsenceCount}
      />
      <CheckField
        checked={policies.attendance.countLateAsAbsence}
        help="If enabled, late records reduce attendance like absences according to the conversion value. Default: off."
        label="Late counts as absence"
        name="countLateAsAbsence"
      />
      <CheckField
        checked={policies.attendance.excusedCountsAsPresent}
        help="If enabled, excused/sick/official absences count as full attendance credit. Default: off or school policy."
        label="Excused counts as present"
        name="excusedCountsAsPresent"
      />
      <CheckField
        checked={policies.attendance.excusedCountsAgainstAttendance}
        help="If enabled, excused records are included in the attendance denominator. If disabled, they are ignored when calculating the attendance rate."
        label="Excused counts in attendance rate"
        name="excusedCountsAgainstAttendance"
      />
      <CheckField
        checked={policies.attendance.allowInstructorOverride}
        help="If enabled, instructors can manually edit attendance records. Default: on."
        label="Allow instructor override"
        name="allowInstructorOverride"
      />
      <FormFooter pending={pending} state={state} />
    </form>
  )
}

function VideoPolicyForm({
  campusId,
  organizationId,
  policies,
}: SharedProps) {
  const [state, formAction, pending] = useActionState(
    saveVideoCompletionPolicy,
    initialPolicyActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <ContextFields campusId={campusId} organizationId={organizationId} />
      <NumberField
        help="Students must watch this percentage of the lesson video to complete it. Default: 90%."
        label="Completion threshold (%)"
        max="100"
        min="1"
        name="completionThresholdPercent"
        step="1"
        value={policies.videoCompletion.completionThresholdPercent}
      />
      <NumberField
        help="Optional minimum number of seconds required, even if the percentage threshold is met."
        label="Minimum watch seconds"
        min="0"
        name="minimumWatchSeconds"
        step="1"
        value={policies.videoCompletion.minimumWatchSeconds ?? ""}
      />
      <CheckField
        checked={policies.videoCompletion.requireActualWatchedCoverage}
        help="If enabled, skipping to the end does not count. The system tracks actual watched intervals."
        label="Require actual watched coverage"
        name="requireActualWatchedCoverage"
      />
      <FormFooter pending={pending} state={state} />
      <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-4">
        YouTube progress depends on the YouTube IFrame Player API and may not
        work for videos that block embedding.
      </p>
    </form>
  )
}

function GradingPolicyForm({
  campusId,
  organizationId,
  policies,
}: SharedProps) {
  const [state, formAction, pending] = useActionState(
    saveGradingAndDocumentPolicy,
    initialPolicyActionState
  )

  return (
    <form action={formAction} className="space-y-4">
      <ContextFields campusId={campusId} organizationId={organizationId} />
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">
          Assignment policy
        </summary>
        <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-4">
          <CheckField
            checked={policies.assignment.allowLateSubmissionDefault}
            help="Default setting for new assignments. Instructors can still override per assignment if allowed."
            label="Allow late submissions by default"
            name="allowLateSubmissionDefault"
          />
          <CheckField
            checked={policies.assignment.allowResubmissionBeforeDue}
            help="If enabled, students can update their submission until the due date."
            label="Allow resubmission before due date"
            name="allowResubmissionBeforeDue"
          />
          <NumberField
            help="Optional percentage penalty for late submissions. Leave 0 for no automatic penalty."
            label="Late penalty (%)"
            max="100"
            min="0"
            name="latePenaltyPercent"
            step="1"
            value={policies.assignment.latePenaltyPercent}
          />
          <NumberField
            help="Optional number of days after due date when late submissions are still accepted."
            label="Maximum late days"
            min="0"
            name="maxLateDays"
            step="1"
            value={policies.assignment.maxLateDays ?? ""}
          />
        </div>
      </details>
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">
          Grade visibility policy
        </summary>
        <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-4">
          <CheckField
            checked={policies.gradeVisibility.studentsCanSeeDraftGrades}
            help="Usually off. If off, students only see grades after they are published or finalized."
            label="Students can see draft grades"
            name="studentsCanSeeDraftGrades"
          />
          <CheckField
            checked={policies.gradeVisibility.parentsCanSeeDraftGrades}
            help="Usually off. If off, parents only see linked students' grades after publication."
            label="Parents can see draft grades"
            name="parentsCanSeeDraftGrades"
          />
          <CheckField
            checked={policies.gradeVisibility.showAssignmentFeedbackBeforeFinalGrade}
            help="If enabled, students can see assignment feedback once a submission is graded."
            label="Show assignment feedback before final grade"
            name="showAssignmentFeedbackBeforeFinalGrade"
          />
          <CheckField
            checked={policies.gradeVisibility.showQuizResultsImmediately}
            help="If enabled, quiz results can be shown after submission/auto-grading, depending on quiz settings."
            label="Show quiz results immediately"
            name="showQuizResultsImmediately"
          />
        </div>
      </details>
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">
          Document policy
        </summary>
        <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-4">
          <CheckField
            checked={policies.document.reportCardsRequirePublishedGrades}
            help="Students and parents can download report cards only after grades are published or finalized."
            label="Report cards visible after published grades"
            name="reportCardsRequirePublishedGrades"
          />
          <CheckField
            checked={policies.document.transcriptsRequirePublishedGrades}
            help="Students and parents can download transcripts only after official grades are available."
            label="Transcripts visible after published/finalized grades"
            name="transcriptsRequirePublishedGrades"
          />
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Admin preview allowed</div>
            <p className="text-xs text-muted-foreground">
              Admins can preview draft documents within their scope.
            </p>
          </div>
        </div>
      </details>
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">
          GPA policy
        </summary>
        <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-4">
          <NumberField
            help="Used as the displayed GPA scale policy. Grade conversion uses the selected grading scale table below."
            label="GPA scale"
            max="10"
            min="0"
            name="gpaScale"
            step="0.1"
            value={policies.gpaScale}
          />
        </div>
      </details>
      <FormFooter pending={pending} state={state} />
    </form>
  )
}

type SharedProps = {
  campusId: string | null
  organizationId: string
  policies: ResolvedPolicies
}

function ContextFields({
  campusId,
  organizationId,
}: Omit<SharedProps, "policies">) {
  return (
    <>
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="campusId" type="hidden" value={campusId ?? ""} />
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
