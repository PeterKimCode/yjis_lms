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
        <div className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            These settings define the default behavior for new assignments.
            Individual assignments may override them when allowed.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CheckField
              checked={policies.assignment.allowLateSubmissionDefault}
              help="Recommended default: off. When enabled, newly created assignments will allow students to submit after the due date by default. Instructors may still override this per assignment if assignment-level override is available."
              label="Allow late submissions by default"
              name="allowLateSubmissionDefault"
              note="If disabled, new assignments will block submissions after the due date unless the instructor explicitly enables late submissions."
            />
            <CheckField
              checked={policies.assignment.allowResubmissionBeforeDue}
              help="Recommended default: on. When enabled, students can update or replace their submission until the due date. After the due date, updates follow the late submission rule."
              label="Allow resubmission before due date"
              name="allowResubmissionBeforeDue"
              note="If disabled, the first submission is treated as final unless an instructor/admin changes it."
            />
            <NumberField
              help="Optional. Percentage deducted from late submissions. Example: 10 means a submission scored 90 would become 81 after a 10% penalty. Use 0 for no automatic penalty."
              label="Late penalty (%)"
              max="100"
              min="0"
              name="latePenaltyPercent"
              note="Penalty is saved as policy and can be applied during grading."
              step="1"
              value={policies.assignment.latePenaltyPercent}
            />
            <NumberField
              help="Optional. Number of days after the due date that late submissions are accepted. Example: 3 means students can submit up to 3 days late. Leave blank for no fixed late window."
              label="Maximum late days"
              min="0"
              name="maxLateDays"
              note="If late submissions are disabled, this value has no effect."
              step="1"
              value={policies.assignment.maxLateDays ?? ""}
            />
          </div>
        </div>
      </details>
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">
          Grade visibility policy
        </summary>
        <div className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            These settings control when students and parents can see grades,
            feedback, and quiz results.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CheckField
              checked={policies.gradeVisibility.studentsCanSeeDraftGrades}
              help="Recommended default: off. If enabled, students can see draft final grades before they are officially published. This is usually disabled to avoid confusion."
              label="Students can see draft grades"
              name="studentsCanSeeDraftGrades"
              warning="Only enable this if your school wants students to preview unofficial grades."
            />
            <CheckField
              checked={policies.gradeVisibility.parentsCanSeeDraftGrades}
              help="Recommended default: off. If enabled, parents can see linked students' draft final grades before official publication."
              label="Parents can see draft grades"
              name="parentsCanSeeDraftGrades"
              warning="Usually disabled because draft grades may still change."
            />
            <CheckField
              checked={
                policies.gradeVisibility.showAssignmentFeedbackBeforeFinalGrade
              }
              help="Recommended default: on. If enabled, students can see assignment scores and teacher feedback after each submission is graded, even before the final course grade is published."
              label="Show assignment feedback before final grade"
              name="showAssignmentFeedbackBeforeFinalGrade"
              note="If disabled, assignment feedback may be hidden until grades are released, depending on the student view implementation."
            />
            <CheckField
              checked={policies.gradeVisibility.showQuizResultsImmediately}
              help="Recommended default: depends on school policy. If enabled, students can see quiz results after submission or auto-grading, subject to each quiz's result visibility settings."
              label="Show quiz results immediately"
              name="showQuizResultsImmediately"
              note="If disabled, quiz results should remain hidden until the instructor or school releases them."
            />
          </div>
        </div>
      </details>
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">
          Document policy
        </summary>
        <div className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            These settings control when report cards and transcripts are
            visible to students and parents.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CheckField
              checked={policies.document.reportCardsRequirePublishedGrades}
              help="Recommended default: on. If enabled, students and parents can download report cards only after final grades are published or finalized."
              label="Report cards visible after published grades"
              name="reportCardsRequirePublishedGrades"
              note="Admins can still generate previews if admin preview is allowed."
            />
            <CheckField
              checked={policies.document.transcriptsRequirePublishedGrades}
              help="Recommended default: on. If enabled, students and parents can download transcripts only after official grades are available."
              label="Transcripts visible after published/finalized grades"
              name="transcriptsRequirePublishedGrades"
              note="For universities, transcripts should normally use finalized or officially published grades."
            />
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">Admin preview allowed</div>
              <p className="text-xs text-muted-foreground">
                Recommended default: on. If enabled, admins and authorized
                academic staff can preview draft report cards or transcripts
                before releasing them to students and parents.
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Preview documents should be treated as unofficial.
              </p>
            </div>
          </div>
        </div>
      </details>
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer text-sm font-medium">
          GPA policy
        </summary>
        <div className="space-y-3 pt-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <NumberField
              help="Displayed maximum GPA scale for this school, such as 4.0, 4.3, or 4.5. Grade conversion still uses the grading scale table below."
              label="GPA scale"
              max="10"
              min="0"
              name="gpaScale"
              note="Changing this value changes the displayed policy scale. To change how scores convert to GPA points, edit the grading scale rows."
              step="0.1"
              value={policies.gpaScale}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Examples: 4.0 scale is common in US universities; 4.5 scale is
            common in Korean universities; 4.3 scale is used by some
            universities.
          </p>
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
  note,
  step,
  value,
}: {
  help: string
  label: string
  max?: string
  min: string
  name: string
  note?: string
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
      {note ? (
        <span className="text-xs text-muted-foreground">{note}</span>
      ) : null}
    </label>
  )
}

function CheckField({
  checked,
  help,
  label,
  name,
  note,
  warning,
}: {
  checked: boolean
  help: string
  label: string
  name: string
  note?: string
  warning?: string
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
        {note ? (
          <span className="mt-1 block text-xs text-muted-foreground">{note}</span>
        ) : null}
        {warning ? (
          <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
            {warning}
          </span>
        ) : null}
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
