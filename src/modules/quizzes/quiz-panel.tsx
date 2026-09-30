"use client"

import { useAssessmentSave } from "@/components/assessment-save"

import Link from "next/link"
import { QuizEditor } from "./quiz-editor"
import type { ReactNode } from "react"
import { useActionState } from "react"

import { ActionFeedback } from "@/components/action-feedback"
import { ConfirmSubmitButton } from "@/components/confirm-submit-button"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  EmptyState,
  SimpleTable,
  StatusBadge,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { initialQuizActionState } from "@/modules/quizzes/action-state"
import {
  gradeQuizAnswer,
  removeExamAttachment,
  removeQuizAttachment,
  saveExam,
  submitQuiz,
} from "@/modules/quizzes/actions"
import {
  getQuizAttemptStatus,
  shouldShowQuizResults,
} from "@/modules/quizzes/status"

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY"

export type QuizPanelValue = {
  id: string
  title: string
  description: string | null
  opensAt: string | null
  closesAt: string | null
  timeLimitMinutes: number | null
  maxAttempts: number | null
  pointsPossible: string | null
  isPublished: boolean
  showResultsToStudents: boolean
  shuffleQuestions: boolean
  attachments: { id: string; name: string }[]
  questions: QuestionValue[]
  attempts: AttemptValue[]
}

export type ExamPanelValue = {
  id: string
  title: string
  examType: string | null
  startsAt: string | null
  endsAt: string | null
  location: string | null
  pointsPossible: string | null
  weight: string | null
  description: string | null
  attachments: { id: string; name: string }[]
}

type QuestionValue = {
  id: string
  type: QuestionType
  prompt: string
  points: string
  sequence: number
  explanation: string | null
  answerKey: unknown
  options: { id: string; text: string; isCorrect: boolean; sequence: number }[]
}

type AttemptValue = {
  id: string
  studentId: string
  studentName: string
  studentEmail: string | null
  attemptNumber: number
  submittedAt: string | null
  score: string | null
  gradedAt: string | null
  answers: AnswerValue[]
}

type AnswerValue = {
  id: string
  questionId: string
  questionPrompt: string
  questionType: QuestionType
  questionPoints: string
  answerText: string | null
  selectedOptionText: string | null
  score: string | null
  feedback: string | null
}

export function QuizPanel({
  classSectionId,
  mode,
  now,
  quizzes,
  userId,
}: {
  classSectionId: string
  mode: "instructor" | "student"
  now: string
  quizzes: QuizPanelValue[]
  userId: string
}) {
  return (
    <div className="space-y-6">
      {mode === "instructor" ? (
        <Button asChild><Link href={`/instructor/classes/${classSectionId}/quizzes/new`}>Create quiz</Link></Button>
      ) : null}
      <SimpleTable
        empty="No quizzes yet."
        headers={
          mode === "instructor"
            ? [
                "Quiz",
                "Opens",
                "Closes",
                "Time limit",
                "Attempts",
                "Status",
                "Questions",
                "Submissions",
                "Graded",
                "Manage",
              ]
            : ["Quiz", "Opens", "Closes", "Status", "Score", "Open"]
        }
        rows={quizzes.map((quiz) => {
          const ownAttempts = quiz.attempts.filter(
            (attempt) => attempt.studentId === userId
          )
          const latestAttempt = ownAttempts[0]
          const gradedCount = quiz.attempts.filter(
            (attempt) => getQuizAttemptStatus(attempt) === "Graded"
          ).length

          return (
            <TableRow key={quiz.id}>
              <TableCell className="font-medium">{quiz.title}</TableCell>
              <TableCell>{formatDateTime(quiz.opensAt)}</TableCell>
              <TableCell>{formatDateTime(quiz.closesAt)}</TableCell>
              {mode === "instructor" ? (
                <>
                  <TableCell>
                    {quiz.timeLimitMinutes
                      ? `${quiz.timeLimitMinutes} min`
                      : "No limit"}
                  </TableCell>
                  <TableCell>{quiz.maxAttempts ?? 1}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={quiz.isPublished ? "Published" : "Draft"}
                      value={quiz.isPublished ? "PUBLISHED" : "DRAFT"}
                    />
                  </TableCell>
                  <TableCell>{quiz.questions.length}</TableCell>
                  <TableCell>{quiz.attempts.length}</TableCell>
                  <TableCell>{gradedCount}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/instructor/classes/${classSectionId}/quizzes/${quiz.id}`}
                      >
                        Manage
                      </Link>
                    </Button>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell>
                    <StatusBadge
                      label={
                        latestAttempt
                          ? getQuizAttemptStatus(latestAttempt)
                          : availabilityLabel(quiz, now)
                      }
                      value={
                        latestAttempt
                          ? getQuizAttemptStatus(latestAttempt)
                              .toUpperCase()
                              .replaceAll(" ", "_")
                          : availabilityLabel(quiz, now)
                              .toUpperCase()
                              .replaceAll(" ", "_")
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {latestAttempt && shouldShowQuizResults(quiz)
                      ? `${latestAttempt.score ?? "0"}/${
                          quiz.pointsPossible ?? totalPoints(quiz)
                        }`
                      : latestAttempt
                        ? "Results hidden"
                        : "-"}
                  </TableCell>
                  <TableCell>
                    <details className="min-w-[280px]">
                      <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">
                        Open
                      </summary>
                      <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
                        {quiz.description ? (
                          <p className="text-sm text-muted-foreground">
                            {quiz.description}
                          </p>
                        ) : null}
                        {quiz.attachments.length ? (
                          <div className="rounded-md border bg-muted/20 p-3">
                            <div className="text-xs font-medium uppercase text-muted-foreground">
                              Quiz PDFs
                            </div>
                            <div className="mt-2">
                              <AttachmentLinks attachments={quiz.attachments} />
                            </div>
                          </div>
                        ) : null}
                        {latestAttempt && shouldShowQuizResults(quiz) ? (
                          <StudentResult quiz={quiz} attempt={latestAttempt} />
                        ) : latestAttempt ? (
                          <p className="text-sm text-muted-foreground">
                            Results are not available yet.
                          </p>
                        ) : (
                          <QuizAttemptForm quiz={quiz} now={now} />
                        )}
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

export function QuizManagePanel({
  classSectionId,
  quiz,
  uploadFailed,
}: {
  classSectionId: string
  quiz: QuizPanelValue
  uploadFailed?: boolean
}) {
  return (
    <div className="space-y-6">
      {quiz.attachments.length ? <div className="rounded border bg-background p-3"><AttachmentLinks attachments={quiz.attachments} removeKind="quiz" /></div> : null}
      <QuizEditor key={`${quiz.id}:${quiz.questions.map((question) => question.id).join(",")}:${Boolean(uploadFailed)}`} classSectionId={classSectionId} quiz={quiz} uploadFailed={uploadFailed} />

      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer text-lg font-semibold">
          Review attempts
        </summary>
        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Review student submissions and manually grade short-answer or essay
            responses when needed.
          </p>
          <AttemptReview quiz={quiz} />
        </div>
      </details>
    </div>
  )
}

function QuizAttemptForm({ quiz, now }: { quiz: QuizPanelValue; now: string }) {
  const [state, formAction, pending] = useActionState(
    submitQuiz,
    initialQuizActionState
  )
  const blocked = availabilityLabel(quiz, now) !== "Available"

  return (
    <form action={formAction} className="space-y-4">
      <input name="quizId" type="hidden" value={quiz.id} />
      {quiz.questions.map((question) => (
        <QuestionInput key={question.id} question={question} />
      ))}
      <ActionFeedback state={state} />
      {blocked ? (
        <p className="text-sm text-destructive">{availabilityLabel(quiz, now)}</p>
      ) : null}
      <Button size="sm" type="submit" disabled={pending || blocked}>
        {pending ? "Submitting..." : "Submit quiz"}
      </Button>
    </form>
  )
}

function QuestionInput({ question }: { question: QuestionValue }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-sm font-medium">
        {question.prompt}{" "}
        <span className="text-muted-foreground">({question.points} pts)</span>
      </div>
      {question.type === "MULTIPLE_CHOICE"
        ? question.options.map((option) => (
            <label className="flex gap-2 text-sm" key={option.id}>
              <input
                name={`answer_${question.id}`}
                type="radio"
                value={option.id}
                required
              />
              {option.text}
            </label>
          ))
        : null}
      {question.type === "TRUE_FALSE" ? (
        <div className="flex gap-4">
          <label className="flex gap-2 text-sm">
            <input
              name={`answer_${question.id}`}
              type="radio"
              value="true"
              required
            />
            True
          </label>
          <label className="flex gap-2 text-sm">
            <input
              name={`answer_${question.id}`}
              type="radio"
              value="false"
              required
            />
            False
          </label>
        </div>
      ) : null}
      {["SHORT_ANSWER", "ESSAY"].includes(question.type) ? (
        <Textarea
          name={`answer_${question.id}`}
          required
          rows={question.type === "ESSAY" ? 5 : 2}
        />
      ) : null}
    </div>
  )
}

function AttemptReview({ quiz }: { quiz: QuizPanelValue }) {
  if (!quiz.attempts.length) return <EmptyState>No attempts yet.</EmptyState>

  return (
    <div className="space-y-3">
      {quiz.attempts.map((attempt) => (
        <details className="rounded-md border p-3" key={attempt.id}>
          <summary className="cursor-pointer text-sm font-medium">
            {attempt.studentName} - {getQuizAttemptStatus(attempt)} -{" "}
            {attempt.score ?? "0"}/{quiz.pointsPossible ?? totalPoints(quiz)}
          </summary>
          <SimpleTable
            empty="No answers."
            headers={["Question", "Answer", "Score", "Feedback", "Grade"]}
            rows={attempt.answers.map((answer) => (
              <TableRow key={answer.id}>
                <TableCell className="font-medium">
                  {answer.questionPrompt}
                </TableCell>
                <TableCell>
                  {answer.selectedOptionText ?? answer.answerText ?? "-"}
                </TableCell>
                <TableCell>
                  {answer.score ?? "-"}/{answer.questionPoints}
                </TableCell>
                <TableCell>{answer.feedback ?? "-"}</TableCell>
                <TableCell>
                  {["ESSAY", "SHORT_ANSWER"].includes(answer.questionType) ? (
                    <GradeAnswerForm answer={answer} />
                  ) : (
                    "Auto"
                  )}
                </TableCell>
              </TableRow>
            ))}
          />
        </details>
      ))}
    </div>
  )
}

function GradeAnswerForm({ answer }: { answer: AnswerValue }) {
  const [state, formAction, pending] = useActionState(
    gradeQuizAnswer,
    initialQuizActionState
  )

  return (
    <form action={formAction} className="min-w-[220px] space-y-2">
      <input name="answerId" type="hidden" value={answer.id} />
      <Input
        inputMode="decimal"
        max={answer.questionPoints}
        min="0"
        name="score"
        placeholder="Score"
        step="0.5"
        type="number"
        defaultValue={answer.score ?? ""}
      />
      <Textarea
        name="feedback"
        placeholder="Feedback"
        rows={2}
        defaultValue={answer.feedback ?? ""}
      />
      <ActionFeedback state={state} />
      <Button size="sm" type="submit" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  )
}

function StudentResult({
  attempt,
  quiz,
}: {
  attempt: AttemptValue
  quiz: QuizPanelValue
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        Score: {attempt.score ?? "0"}/{quiz.pointsPossible ?? totalPoints(quiz)}
      </p>
      <SimpleTable
        empty="No answers."
        headers={["Question", "Answer", "Score", "Feedback"]}
        rows={attempt.answers.map((answer) => (
          <TableRow key={answer.id}>
            <TableCell>{answer.questionPrompt}</TableCell>
            <TableCell>
              {answer.selectedOptionText ?? answer.answerText ?? "-"}
            </TableCell>
            <TableCell>
              {answer.score ?? "-"}/{answer.questionPoints}
            </TableCell>
            <TableCell>{answer.feedback ?? "-"}</TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

export function ExamPanel({
  classSectionId,
  exams,
}: {
  classSectionId: string
  exams: ExamPanelValue[]
}) {
  return (
    <div className="space-y-4">
      <FormDialog
        title="Create exam"
        trigger="Create exam"
      >
        <ExamForm classSectionId={classSectionId} />
      </FormDialog>
      <SimpleTable
        empty="No exams yet."
        headers={["Title", "Type", "Starts", "Ends", "Max score", "Location", "PDFs"]}
        rows={exams.map((exam) => (
          <TableRow key={exam.id}>
            <TableCell className="font-medium">{exam.title}</TableCell>
            <TableCell>{exam.examType ?? "CUSTOM"}</TableCell>
            <TableCell>{formatDateTime(exam.startsAt)}</TableCell>
            <TableCell>{formatDateTime(exam.endsAt)}</TableCell>
            <TableCell>{exam.pointsPossible ?? "-"}</TableCell>
            <TableCell>{exam.location ?? "-"}</TableCell>
            <TableCell>
              {exam.attachments.length ? (
                <AttachmentLinks
                  attachments={exam.attachments}
                  removeKind="exam"
                />
              ) : (
                "-"
              )}
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function ExamForm({ classSectionId }: { classSectionId: string }) {
  const {state, pending, onSubmit} = useAssessmentSave(
    saveExam,
    initialQuizActionState
  )

  return (
    <form onInvalid={(event) => { const details = (event.target as HTMLElement).closest("details"); if (details) details.open = true }} onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <Field label="Title">
        <Input name="title" required placeholder="Example: Midterm exam" />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.title}</span></Field>
      <Field label="Type">
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="examType"
          defaultValue="CUSTOM"
        >
          {["MIDTERM", "FINAL", "PRACTICAL", "ORAL", "CUSTOM"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.examType}</span></Field>
      <Field label="Starts at">
        <Input name="startsAt" type="datetime-local" />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.startsAt}</span></Field>
      <Field label="Ends at">
        <Input name="endsAt" type="datetime-local" />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.endsAt}</span></Field>
      <Field label="Location">
        <Input name="location" placeholder="Room 101 or online" />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.location}</span></Field>
      <Field label="Description (optional)" className="md:col-span-2">
        <Textarea name="description" rows={2} />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.description}</span></Field>
      <Field
        label="PDF attachment (optional)"
        help="PDF only. Max 20MB."
        className="md:col-span-2"
      >
        <Input accept="application/pdf,.pdf" name="pdfAttachmentFile" type="file" />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.pdfAttachmentFile}</span></Field>
      <details className="rounded-lg border p-3 md:col-span-2"><summary className="cursor-pointer text-sm font-medium">Additional settings</summary><div className="mt-3 grid gap-3 md:grid-cols-2">      <Field label="Max score">
        <Input
          inputMode="decimal"
          min="0"
          name="pointsPossible"
          step="0.5"
          type="number"
        />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.pointsPossible}</span></Field>
      <Field label="Weight">
        <Input
          inputMode="decimal"
          min="0"
          name="weight"
          step="0.5"
          type="number"
        />
      <span role="alert" className="text-xs text-red-700">{state.fieldErrors?.weight}</span></Field>
</div></details>
      <ActionFeedback closeOnSuccess state={state} />
      <div className="flex items-end">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Create exam"}
        </Button>
      </div>
    </form>
  )
}

function Field({
  children,
  className = "",
  help,
  label,
}: {
  children: ReactNode
  className?: string
  help?: string
  label: string
}) {
  return (
    <label className={`grid min-w-0 gap-1 text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
      {help ? <span className="text-xs text-muted-foreground">{help}</span> : null}
    </label>
  )
}


function AttachmentLinks({
  attachments,
  removeKind,
}: {
  attachments: { id: string; name: string }[]
  removeKind?: "quiz" | "exam"
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
          {removeKind ? (
            <RemoveAttachmentForm
              fileAssetId={attachment.id}
              removeKind={removeKind}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function RemoveAttachmentForm({
  fileAssetId,
  removeKind,
}: {
  fileAssetId: string
  removeKind: "quiz" | "exam"
}) {
  const [state, formAction, pending] = useActionState(
    removeKind === "quiz" ? removeQuizAttachment : removeExamAttachment,
    initialQuizActionState
  )

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input name="fileAssetId" type="hidden" value={fileAssetId} />
      <ActionFeedback state={state} />
      <ConfirmSubmitButton
        confirmMessage={`Remove this ${removeKind} PDF attachment?`}
        disabled={pending}
      >
        Remove PDF
      </ConfirmSubmitButton>
    </form>
  )
}

function availabilityLabel(quiz: QuizPanelValue, now: string) {
  const current = new Date(now).getTime()
  if (!quiz.isPublished) return "Not published"
  if (quiz.opensAt && new Date(quiz.opensAt).getTime() > current) {
    return "Not open yet"
  }
  if (quiz.closesAt && new Date(quiz.closesAt).getTime() < current) {
    return "Closed"
  }
  return "Available"
}

function totalPoints(quiz: QuizPanelValue) {
  return quiz.questions
    .reduce((total, question) => total + Number(question.points), 0)
    .toFixed(2)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
