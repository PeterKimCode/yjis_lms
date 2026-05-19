"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteAssignment,
  gradeSubmission,
  saveAssignment,
  submitAssignment,
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
  title: string
  description: string | null
  dueAt: string | null
  pointsPossible: string | null
  acceptsLate: boolean
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
  return (
    <div className="space-y-4">
      {mode === "instructor" ? (
        <>
          <details className="rounded-md border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Create assignment
            </summary>
            <div className="pt-3">
              <AssignmentForm
                classSectionId={classSectionId}
                defaultAcceptsLate={defaultAcceptsLate}
              />
            </div>
          </details>
          <p className="text-xs text-muted-foreground">
            Instructor-provided assignment attachments are not in the current
            schema yet. Student submission attachments are supported below.
          </p>
        </>
      ) : null}
      <SimpleTable
        empty="No assignments yet."
        headers={
          mode === "instructor"
            ? [
                "Title",
                "Due",
                "Max score",
                "Late",
                "Submissions",
                "Graded",
                "Details",
              ]
            : ["Title", "Due", "Max score", "Status", "Score", "Open"]
        }
        rows={assignments.map((assignment) => {
          const ownSubmission = assignment.submissions.find(
            (submission) => submission.studentId === userId
          )
          const gradedCount = assignment.submissions.filter(
            (submission) => submission.score !== null
          ).length

          return (
            <TableRow key={assignment.id}>
              <TableCell className="font-medium">{assignment.title}</TableCell>
              <TableCell>{formatDateTime(assignment.dueAt)}</TableCell>
              <TableCell>{assignment.pointsPossible ?? "-"}</TableCell>
              {mode === "instructor" ? (
                <>
                  <TableCell>
                    <StatusBadge
                      label={assignment.acceptsLate ? "Allowed" : "Closed"}
                      value={assignment.acceptsLate ? "ACTIVE" : "DRAFT"}
                    />
                  </TableCell>
                  <TableCell>{assignment.submissions.length}</TableCell>
                  <TableCell>{gradedCount}</TableCell>
                  <TableCell>
                    <details className="min-w-[260px]">
                      <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">
                        Manage
                      </summary>
                      <div className="mt-3 space-y-4 rounded-md border bg-background p-3">
                        <details className="rounded-md border p-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            Edit assignment
                          </summary>
                          <div className="pt-3">
                            <AssignmentForm
                              assignment={assignment}
                              classSectionId={classSectionId}
                              defaultAcceptsLate={defaultAcceptsLate}
                            />
                          </div>
                        </details>
                        <details className="rounded-md border p-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            Review submissions
                          </summary>
                          <div className="space-y-3 pt-3">
                            <DeleteAssignmentForm assignmentId={assignment.id} />
                            <SubmissionReview assignment={assignment} />
                          </div>
                        </details>
                      </div>
                    </details>
                  </TableCell>
                </>
              ) : (
                <>
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
                    <details className="min-w-[260px]">
                      <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">
                        Open
                      </summary>
                      <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
                        {assignment.description ? (
                          <p className="text-sm text-muted-foreground">
                            {assignment.description}
                          </p>
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
                    </details>
                  </TableCell>
                </>
              )}
            </TableRow>
          )
        })}
      />
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
  const [state, formAction, pending] = useActionState(
    saveAssignment,
    initialAssignmentActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={assignment?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Title</span>
        <Input name="title" required defaultValue={assignment?.title ?? ""} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Due at</span>
        <Input
          name="dueAt"
          type="datetime-local"
          defaultValue={toLocalInputDate(assignment?.dueAt)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Max score</span>
        <Input
          min="0.01"
          name="pointsPossible"
          required
          step="0.01"
          type="number"
          defaultValue={assignment?.pointsPossible ?? "100"}
        />
      </label>
      <label className="flex items-end gap-2 text-sm">
        <input
          name="acceptsLate"
          type="checkbox"
          defaultChecked={assignment?.acceptsLate ?? defaultAcceptsLate}
        />
        Allow late submission
      </label>
      <label className="grid gap-1 text-sm md:col-span-2 xl:col-span-4">
        <span className="font-medium">Description</span>
        <Textarea
          name="description"
          rows={3}
          defaultValue={assignment?.description ?? ""}
        />
      </label>
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <div className="flex items-end">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : assignment ? "Save assignment" : "Create assignment"}
        </Button>
      </div>
    </form>
  )
}

function DeleteAssignmentForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteAssignment,
    initialAssignmentActionState
  )

  return (
    <form action={formAction} className="space-y-2">
      <input name="assignmentId" type="hidden" value={assignmentId} />
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button size="sm" type="submit" variant="destructive" disabled={pending}>
        Delete assignment
      </Button>
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
      {state.message || isClosed ? (
        <p
          className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
          role="status"
        >
          {isClosed ? "This assignment is closed for submissions." : state.message}
        </p>
      ) : null}
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
    <SimpleTable
      empty="No submissions yet."
      headers={[
        "Student",
        "Submitted",
        "Status",
        "Response",
        "Attachment",
        "Score",
        "Feedback",
        "Grade",
      ]}
      rows={assignment.submissions.map((submission) => (
        <TableRow key={submission.id}>
          <TableCell>
            <div className="font-medium">{submission.studentName}</div>
            <div className="text-xs text-muted-foreground">
              {submission.studentEmail ?? "-"}
            </div>
          </TableCell>
          <TableCell>{formatDateTime(submission.submittedAt)}</TableCell>
          <TableCell>
            {getSubmissionStatus({
              dueAt: assignment.dueAt,
              score: submission.score,
              submittedAt: submission.submittedAt,
            })}
          </TableCell>
          <TableCell className="max-w-[260px] truncate">
            {submission.content ?? "-"}
          </TableCell>
          <TableCell>
            {submission.attachments.length ? (
              <AttachmentLinks attachments={submission.attachments} />
            ) : (
              "-"
            )}
          </TableCell>
          <TableCell>
            {submission.score
              ? `${submission.score}/${assignment.pointsPossible ?? "-"}`
              : "-"}
          </TableCell>
          <TableCell className="max-w-[220px] truncate">
            {submission.feedback ?? "-"}
          </TableCell>
          <TableCell>
            <GradeForm assignment={assignment} submission={submission} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}

function AttachmentLinks({
  attachments,
}: {
  attachments: { id: string; name: string }[]
}) {
  return (
    <div className="space-y-1">
      {attachments.map((attachment) => (
        <a
          className="block max-w-[220px] truncate text-primary underline-offset-4 hover:underline"
          href={`/api/files/${attachment.id}/download`}
          key={attachment.id}
          title={attachment.name}
        >
          {attachment.name}
        </a>
      ))}
    </div>
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
      {state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button size="sm" type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving..." : "Save grade"}
      </Button>
    </form>
  )
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function toLocalInputDate(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60 * 1000

  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
