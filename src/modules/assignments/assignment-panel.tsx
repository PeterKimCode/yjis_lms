"use client"

import { AssessmentAttachments } from "@/modules/files/assessment-attachments"
import { dateTimeLocalInTimeZone, formatDateTimeInTimeZone } from "@/lib/timezone"
import { useAssessmentSave } from "@/components/assessment-save"

import { useActionState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { DraftNotice, useFormDraft } from "@/components/use-form-draft"

import { ActionFeedback } from "@/components/action-feedback"
import { ConfirmSubmitButton } from "@/components/confirm-submit-button"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteAssignment,
  gradeSubmission,
  saveAssignment,
  submitAssignment,
  removeAssignmentAttachment,
} from "@/modules/assignments/actions"
import { initialAssignmentActionState } from "@/modules/assignments/action-state"
import { getSubmissionStatus } from "@/modules/assignments/status"
import {
  EmptyState,
  SimpleTable,
  StatusBadge,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"

export type AssignmentPanelValue = {
  id: string
  timeZone: string
  title: string
  description: string | null
  dueAt: string | null
  pointsPossible: string | null
  acceptsLate: boolean
  attachments: { id: string; name: string }[]
  submissions: AssignmentSubmissionValue[]
}

type AssignmentSubmissionValue = {
  id: string
  studentId: string
  studentName: string
  studentEmail: string | null
  content: string | null
  submittedAt: string | null
  score: string | null
  feedback: string | null
  gradedAt: string | null
  attachments: { id: string; name: string }[]
}

export function AssignmentPanel({
  assignments,
  classSectionId,
  defaultAcceptsLate,
  mode,
  now,
  userId,
}: {
  assignments: AssignmentPanelValue[]
  classSectionId: string
  defaultAcceptsLate: boolean
  mode: "instructor" | "student"
  now: string
  userId: string
}) {
  const query = useSearchParams()
  return (
    <div className="space-y-4">
      {mode === "instructor" ? (
        <>
          <FormDialog
            title="Create assignment"
            trigger="Create assignment"
          >
            <AssignmentForm
              classSectionId={classSectionId}
              defaultAcceptsLate={defaultAcceptsLate}
            />
          </FormDialog>
        </>
      ) : null}
      {mode === "instructor" ? (
        <InstructorAssignmentList
          assignments={assignments}
          classSectionId={classSectionId}
          defaultAcceptsLate={defaultAcceptsLate}
        />
      ) : (
        <SimpleTable
          empty="No assignments yet."
          headers={["Title", "Due", "Max score", "Status", "Score", "Open"]}
          rows={assignments.map((assignment) => {
            const ownSubmission = assignment.submissions.find(
              (submission) => submission.studentId === userId
            )

            return (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">{assignment.title}</TableCell>
                <TableCell>{formatDateTime(assignment.dueAt, assignment.timeZone)}</TableCell>
                <TableCell>{assignment.pointsPossible ?? "-"}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={getSubmissionStatus({
                      dueAt: assignment.dueAt,
                      score: ownSubmission?.score,
                      submittedAt: ownSubmission?.submittedAt,
                    })}
                    value={getSubmissionStatus({
                      dueAt: assignment.dueAt,
                      score: ownSubmission?.score,
                      submittedAt: ownSubmission?.submittedAt,
                    }).toUpperCase().replaceAll(" ", "_")}
                  />
                </TableCell>
                <TableCell>
                  {ownSubmission?.score
                    ? `${ownSubmission.score}/${assignment.pointsPossible ?? "-"}`
                    : "-"}
                </TableCell>
                <TableCell>
                  <FormDialog
                    title={assignment.title}
                    initialOpen={query.get("assignmentId") === assignment.id}
                    description="View assignment details, update your response, and upload an attachment."
                    trigger={ownSubmission ? "View / update" : "Open"}
                    variant="outline"
                  >
                    <div className="space-y-4">
                      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
                        <SubmissionMeta
                          label="Due"
                          value={formatDateTime(assignment.dueAt, assignment.timeZone)}
                        />
                        <SubmissionMeta
                          label="Max score"
                          value={assignment.pointsPossible ?? "-"}
                        />
                        <SubmissionMeta
                          label="Status"
                          value={getSubmissionStatus({
                            dueAt: assignment.dueAt,
                            score: ownSubmission?.score,
                            submittedAt: ownSubmission?.submittedAt,
                          })}
                        />
                      </div>
                      {assignment.description ? (
                        <div className="rounded-lg border bg-background p-3">
                          <div className="text-xs font-medium uppercase text-muted-foreground">
                            Instructions
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm">
                            {assignment.description}
                          </p>
                        </div>
                      ) : null}
                      {assignment.attachments.length ? (
                        <div className="rounded-lg border bg-background p-3">
                          <div className="text-xs font-medium uppercase text-muted-foreground">
                            Assignment PDFs
                          </div>
                          <div className="mt-2">
                            <AttachmentLinks attachments={assignment.attachments} />
                          </div>
                        </div>
                      ) : null}
                      {ownSubmission?.feedback ? (
                        <div className="rounded-md border p-3 text-sm">
                          <div className="font-medium">Feedback</div>
                          <p className="mt-1 text-muted-foreground">
                            {ownSubmission.feedback}
                          </p>
                        </div>
                      ) : null}
                      {ownSubmission?.attachments.length ? (
                        <AttachmentLinks attachments={ownSubmission.attachments} />
                      ) : null}
                      <SubmissionForm
                        assignment={assignment}
                        now={now}
                        submission={ownSubmission}
                      />
                    </div>
                  </FormDialog>
                </TableCell>
              </TableRow>
            )
          })}
        />
      )}
    </div>
  )
}

function InstructorAssignmentList({
  assignments,
  classSectionId,
  defaultAcceptsLate,
}: {
  assignments: AssignmentPanelValue[]
  classSectionId: string
  defaultAcceptsLate: boolean
}) {
  if (!assignments.length) {
    return <EmptyState>No assignments yet.</EmptyState>
  }

  return (
    <div className="grid gap-3">
      {assignments.map((assignment) => {
        const gradedCount = assignment.submissions.filter(
          (submission) => submission.score !== null
        ).length

        return (
          <article className="min-w-0 rounded-xl border bg-card px-4 py-3 text-sm" key={assignment.id}>
            <header className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="min-w-0 break-words text-base font-semibold">{assignment.title}</h2>
              <span><span className="font-medium">Due: </span>{formatDateTime(assignment.dueAt, assignment.timeZone)}</span>
              <span className="text-muted-foreground">{assignment.pointsPossible ?? "-"} points · {assignment.timeZone}</span>
              <span>Submissions: {assignment.submissions.length} · Graded: {gradedCount}</span>
              <StatusBadge label={assignment.acceptsLate ? "Late submissions allowed" : "No late submissions"} value={assignment.acceptsLate ? "ACTIVE" : "DRAFT"} />
            </header>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <FormDialog title={`Edit assignment: ${assignment.title}`} trigger="Edit assignment" variant="outline">
                <AssignmentForm assignment={assignment} classSectionId={classSectionId} defaultAcceptsLate={defaultAcceptsLate} />
              </FormDialog>
              <FormDialog title={`Review submissions: ${assignment.title}`} trigger="Review / Grade" variant="outline">
                <SubmissionReview assignment={assignment} />
              </FormDialog>
              {assignment.attachments.length ? (
                <FormDialog title={`Attachments: ${assignment.title}`} trigger={`Attachments · ${assignment.attachments.length}`} variant="outline">
                  <AssessmentAttachments attachments={assignment.attachments} kind="assignment" ownerId={assignment.id} />
                </FormDialog>
              ) : null}
              <DeleteAssignmentForm assignmentId={assignment.id} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function AssignmentForm({
  assignment,
  classSectionId,
  defaultAcceptsLate,
}: {
  assignment?: AssignmentPanelValue
  classSectionId: string
  defaultAcceptsLate: boolean
}) {
  const {state, pending, onSubmit} = useAssessmentSave(
    saveAssignment,
    initialAssignmentActionState
  )
  const form = useRef<HTMLFormElement>(null)
  const draft = useFormDraft({ form, scope: `assignment:${classSectionId}:${assignment?.id ?? "new"}`, saved: state.ok })

  return (
    <>
    <form ref={form} onSubmit={onSubmit} className="grid min-w-0 gap-4 rounded-xl border border-slate-300 bg-card p-4 md:grid-cols-2 [&_input:not([type=checkbox])]:border-slate-400 [&_input:not([type=checkbox])]:bg-background [&_textarea]:border-slate-400 [&_textarea]:bg-background">
      <DraftNotice draft={draft} />
      <input name="id" type="hidden" value={assignment?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Title</span>
        <Input name="title" required defaultValue={assignment?.title ?? ""} />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.title}</span></label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Due at</span>
        <Input
          name="dueAt"
          type="datetime-local"
          defaultValue={dateTimeLocalInTimeZone(assignment?.dueAt, assignment?.timeZone ?? "Asia/Seoul")}
        />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.dueAt}</span></label>
      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="font-medium">Description</span>
        <Textarea
          name="description"
          rows={3}
          defaultValue={assignment?.description ?? ""}
        />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.description}</span></label>
      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="font-medium">PDF attachment</span>
        <Input
          accept="application/pdf,.pdf"
          name="pdfAttachmentFile"
          type="file"
        />
        <span className="text-xs text-muted-foreground">
          PDF only. Max 20MB.
        </span>
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.pdfAttachmentFile}</span></label>
      <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 md:col-span-2 dark:border-blue-900 dark:bg-blue-950/30"><h3 className="text-sm font-semibold text-blue-950 dark:text-blue-100">Assignment settings</h3><div className="mt-3 grid gap-4 md:grid-cols-2">      <label className="grid gap-1 text-sm">
        <span className="font-medium">Max score</span>
        <Input
          min="0.01"
          name="pointsPossible"
          required
          step="0.01"
          type="number"
          defaultValue={assignment?.pointsPossible ?? "100"}
        />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.pointsPossible}</span></label>
      <label className="flex items-end gap-2 text-sm">
        <input
          name="acceptsLate"
          type="checkbox"
          defaultChecked={assignment?.acceptsLate ?? defaultAcceptsLate}
        />
        Allow late submission
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.acceptsLate}</span></label>
</div></section>
      <ActionFeedback closeOnSuccess state={state} />
      <div className="flex items-end justify-end border-t pt-3 md:col-span-2">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : assignment ? "Save assignment" : "Create assignment"}
        </Button>
      </div>
    </form>
    {assignment?<section className="mt-4 space-y-3 rounded-xl border border-slate-300 bg-card p-4"><h3 className="text-base font-semibold">Existing attachments</h3><AssessmentAttachments attachments={assignment.attachments} kind="assignment" ownerId={assignment.id}/></section>:null}
    </>
  )
}

function DeleteAssignmentForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteAssignment,
    initialAssignmentActionState
  )

  return (
    <form action={formAction} className="space-y-1">
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <ActionFeedback state={state} />
      <ConfirmSubmitButton
        confirmMessage="Delete this assignment? Existing submissions may be affected."
        disabled={pending}
      >
        Delete assignment
      </ConfirmSubmitButton>
    </form>
  )
}

function SubmissionForm({
  assignment,
  now,
  submission,
}: {
  assignment: AssignmentPanelValue
  now: string
  submission?: AssignmentSubmissionValue
}) {
  const [state, formAction, pending] = useActionState(
    submitAssignment,
    initialAssignmentActionState
  )
  const isClosed =
    assignment.dueAt &&
    new Date(assignment.dueAt).getTime() < new Date(now).getTime() &&
    !assignment.acceptsLate

  return (
    <form action={formAction} className="space-y-3">
      <input name="assignmentId" type="hidden" value={assignment.id} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Text response</span>
        <Textarea
          name="content"
          required
          rows={5}
          defaultValue={submission?.content ?? ""}
          disabled={Boolean(isClosed)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Attachment</span>
        <Input
          name="attachmentFile"
          type="file"
          disabled={Boolean(isClosed)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Allowed: PDF, Office files, text, images, CSV, ZIP. Max 20 MB.
        Executable/script files are blocked.
      </p>
      {submission?.submittedAt ? (
        <p className="text-xs text-muted-foreground">
          Last submitted: {formatDateTime(submission.submittedAt)}
        </p>
      ) : null}
      {isClosed ? (
        <p
          className="text-sm text-destructive"
          role="status"
        >
          This assignment is closed for submissions.
        </p>
      ) : null}
      <ActionFeedback state={state} />
      <Button size="sm" type="submit" disabled={pending || Boolean(isClosed)}>
        {pending ? "Submitting..." : submission ? "Update submission" : "Submit"}
      </Button>
    </form>
  )
}

function SubmissionReview({ assignment }: { assignment: AssignmentPanelValue }) {
  if (!assignment.submissions.length) {
    return <EmptyState>No submissions yet.</EmptyState>
  }

  return (
    <div className="grid gap-4">
      {assignment.submissions.map((submission) => {
        const status = getSubmissionStatus({
          dueAt: assignment.dueAt,
          score: submission.score,
          submittedAt: submission.submittedAt,
        })

        return (
          <article
            className="rounded-xl border bg-background p-4 shadow-sm"
            key={submission.id}
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      {submission.studentName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {submission.studentEmail ?? "-"}
                    </p>
                  </div>
                  <StatusBadge
                    label={status}
                    value={status.toUpperCase().replaceAll(" ", "_")}
                  />
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <SubmissionMeta
                    label="Submitted"
                    value={formatDateTime(submission.submittedAt)}
                  />
                  <SubmissionMeta
                    label="Score"
                    value={
                      submission.score
                        ? `${submission.score}/${assignment.pointsPossible ?? "-"}`
                        : "-"
                    }
                  />
                  <SubmissionMeta
                    label="Graded"
                    value={formatDateTime(submission.gradedAt)}
                  />
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Response
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {submission.content?.trim() || "No text response."}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Attachment
                  </div>
                  <div className="mt-2">
                    {submission.attachments.length ? (
                      <AttachmentLinks attachments={submission.attachments} />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No attachment.
                      </span>
                    )}
                  </div>
                </div>
                {submission.feedback ? (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Current feedback
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {submission.feedback}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border bg-white/80 p-3">
                <div className="mb-3 text-sm font-semibold">
                  Grade submission
                </div>
                <GradeForm assignment={assignment} submission={submission} />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SubmissionMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white/70 p-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  )
}

function AttachmentLinks({
  attachments,
  removable = false,
}: {
  attachments: { id: string; name: string }[]
  removable?: boolean
}) {
  return (
    <div className="space-y-1">
      {attachments.map((attachment) => (
        <div className="flex flex-wrap items-center gap-2" key={attachment.id}>
          <a
            className="block max-w-[260px] truncate text-primary underline-offset-4 hover:underline"
            href={`/api/files/${attachment.id}/download`}
            title={attachment.name}
          >
            {attachment.name}
          </a>
          {removable ? (
            <RemoveAssignmentAttachmentForm fileAssetId={attachment.id} />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function RemoveAssignmentAttachmentForm({ fileAssetId }: { fileAssetId: string }) {
  const [state, formAction, pending] = useActionState(
    removeAssignmentAttachment,
    initialAssignmentActionState
  )

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input name="fileAssetId" type="hidden" value={fileAssetId} />
      <ActionFeedback state={state} />
      <ConfirmSubmitButton
        confirmMessage="Remove this PDF attachment from the assignment?"
        disabled={pending}
      >
        Remove PDF
      </ConfirmSubmitButton>
    </form>
  )
}

function GradeForm({
  assignment,
  submission,
}: {
  assignment: AssignmentPanelValue
  submission: AssignmentSubmissionValue
}) {
  const [state, formAction, pending] = useActionState(
    gradeSubmission,
    initialAssignmentActionState
  )

  return (
    <form action={formAction} className="min-w-[240px] space-y-2">
      <input name="submissionId" type="hidden" value={submission.id} />
      <Input
        max={assignment.pointsPossible ?? undefined}
        min="0"
        name="score"
        placeholder="Score"
        step="0.01"
        type="number"
        defaultValue={submission.score ?? ""}
      />
      <Textarea
        name="feedback"
        placeholder="Feedback"
        rows={2}
        defaultValue={submission.feedback ?? ""}
      />
      <ActionFeedback state={state} />
      <Button size="sm" type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving..." : "Save grade"}
      </Button>
    </form>
  )
}

function formatDateTime(value: string | null | undefined, timeZone = "Asia/Seoul") {
  return formatDateTimeInTimeZone(value?new Date(value):null,timeZone)
}
