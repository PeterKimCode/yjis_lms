"use client"

import Link from "next/link"
import { AssessmentAttachments } from "@/modules/files/assessment-attachments"
import { assessmentTypeLabel } from "./assessment-types"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { QuizEditor } from "./quiz-editor"
import { useActionState } from "react"

import { ActionFeedback } from "@/components/action-feedback"
import { ConfirmSubmitButton } from "@/components/confirm-submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  EmptyState,
  SimpleTable,
  StatusBadge,
  TableCell,
  TableRow
} from "@/modules/dashboards/components"
import { initialQuizActionState } from "@/modules/quizzes/action-state"
import {
  archiveAssessment,
  gradeQuizAnswer,
  submitQuiz
} from "@/modules/quizzes/actions"
import {
  getQuizAttemptStatus,
  shouldShowQuizResults
} from "@/modules/quizzes/status"

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY"

export type QuizPanelValue = {
  id: string
  assessmentType: string
  location: string | null
  timeZone: string
  legacyScore?: { score: string; possible: string }
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
  userId
}: {
  classSectionId: string
  mode: "instructor" | "student"
  now: string
  quizzes: QuizPanelValue[]
  userId: string
}) {
  return (
    <div className="space-y-4">
      {mode === "instructor" ? (
        <Button asChild>
          <Link href={`/instructor/classes/${classSectionId}/quizzes/new`}>
            Create assessment
          </Link>
        </Button>
      ) : null}
      {!quizzes.length ? <EmptyState>No assessments yet.</EmptyState> : null}
      {quizzes.map((quiz) => {
        const ownAttempts = quiz.attempts.filter(
            (attempt) => attempt.studentId === userId
          ),
          latest = ownAttempts[0]
        return (
          <article
            key={quiz.id}
            className="min-w-0 rounded-xl border bg-card px-4 py-3 text-sm"
          >
            <AssessmentHeader quiz={quiz} />
            {mode === "instructor" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/instructor/classes/${classSectionId}/quizzes/${quiz.id}`}
                  >
                    Edit / Grade
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/instructor/classes/${classSectionId}/quizzes/${quiz.id}?preview=1`}
                  >
                    Student preview
                  </Link>
                </Button>
                <DeleteAssessment id={quiz.id} />
              </div>
            ) : (
              <details>
                <summary className="cursor-pointer font-medium text-primary">
                  Open assessment{" "}
                  {latest ? `· ${getQuizAttemptStatus(latest)}` : ""}
                </summary>
                <div className="pt-4">
                  <StudentAssessmentPaper
                    quiz={quiz}
                    now={now}
                    attempt={latest}
                  />
                </div>
              </details>
            )}
          </article>
        )
      })}
    </div>
  )
}
function DeleteAssessment({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    archiveAssessment,
    initialQuizActionState
  )
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton
        disabled={pending}
        confirmMessage="Delete this assessment? Submitted answers will be retained."
      >
        Delete
      </ConfirmSubmitButton>
      <ActionFeedback state={state} />
    </form>
  )
}
export function AssessmentHeader({ quiz }: { quiz: QuizPanelValue }) {
  return (
    <header className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <h2 className="min-w-0 break-words text-base font-semibold">{quiz.title}</h2>
      <StatusBadge label={quiz.isPublished ? "Published" : "Draft"} value={quiz.isPublished ? "PUBLISHED" : "DRAFT"} />
      <span className="text-muted-foreground">{assessmentTypeLabel(quiz.assessmentType)} · {quiz.pointsPossible ?? totalPoints(quiz)} points</span>
      <span><span className="font-medium">Starts: </span>{formatDateTimeInTimeZone(quiz.opensAt ? new Date(quiz.opensAt) : null, quiz.timeZone)}</span>
      <span><span className="font-medium">Ends: </span>{formatDateTimeInTimeZone(quiz.closesAt ? new Date(quiz.closesAt) : null, quiz.timeZone)}</span>
      <span className="text-xs text-muted-foreground">{quiz.timeZone}{quiz.location ? ` · ${quiz.location}` : ""}</span>
    </header>
  )
}
export function StudentAssessmentPaper({
  quiz,
  now,
  attempt,
  preview = false
}: {
  quiz: QuizPanelValue
  now: string
  attempt?: AttemptValue
  preview?: boolean
}) {
  return (
    <div className="space-y-4 text-sm">
      {preview ? (
        <p className="rounded-lg border bg-muted/30 p-3">
          Student preview — answers are not saved.
        </p>
      ) : null}
      {quiz.description ? (
        <p className="whitespace-pre-wrap">{quiz.description}</p>
      ) : null}
      <AssessmentAttachments attachments={quiz.attachments} />
      {quiz.legacyScore ? (
        <p className="rounded-lg border p-3 font-medium">
          Recorded score: {quiz.legacyScore.score} / {quiz.legacyScore.possible}
        </p>
      ) : null}
      {attempt && !preview ? (
        shouldShowQuizResults(quiz) && attempt.gradedAt ? (
          <StudentResult quiz={quiz} attempt={attempt} />
        ) : (
          <p>Results are not available yet.</p>
        )
      ) : (
        <QuizAttemptForm quiz={quiz} now={now} preview={preview} />
      )}
    </div>
  )
}

export function QuizManagePanel({
  classSectionId,
  quiz,
  uploadFailed
}: {
  classSectionId: string
  quiz: QuizPanelValue
  uploadFailed?: boolean
}) {
  return (
    <div className="space-y-6 pb-44 md:pb-28">
      {quiz.attachments.length ? (
        <div className="rounded border bg-background p-3">
          <h2 className="mb-3 text-base font-semibold">Attachments</h2>
          <AssessmentAttachments
            attachments={quiz.attachments}
            kind="quiz"
            ownerId={quiz.id}
          />
        </div>
      ) : null}
      <QuizEditor
        key={`${quiz.id}:${quiz.questions.map((question) => question.id).join(",")}:${Boolean(uploadFailed)}`}
        classSectionId={classSectionId}
        quiz={quiz}
        timeZone={quiz.timeZone}
        uploadFailed={uploadFailed}
      />

      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer text-base font-semibold">
          Review attempts
        </summary>
        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Legacy exam grades remain available under Grades. Review student
            submissions and manually grade short-answer or essay responses when
            needed.
          </p>
          <AttemptReview quiz={quiz} />
        </div>
      </details>
    </div>
  )
}

function QuizAttemptForm({
  quiz,
  now,
  preview = false
}: {
  quiz: QuizPanelValue
  now: string
  preview?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    submitQuiz,
    initialQuizActionState
  )
  const blocked =
    !quiz.questions.length || availabilityLabel(quiz, now) !== "Available"

  return (
    <form
      action={preview ? undefined : formAction}
      onSubmit={preview ? (event) => event.preventDefault() : undefined}
      className="space-y-4"
    >
      <input name="quizId" type="hidden" value={quiz.id} />
      {quiz.questions.map((question) => (
        <QuestionInput key={question.id} question={question} />
      ))}
      <ActionFeedback state={state} />
      {blocked && !preview ? (
        <p className="text-sm text-destructive">
          {!quiz.questions.length
            ? "No answer fields are available yet."
            : availabilityLabel(quiz, now)}
        </p>
      ) : null}
      <Button size="sm" type="submit" disabled={preview || pending || blocked}>
        {preview
          ? "Preview only"
          : pending
            ? "Submitting..."
            : "Submit answers"}
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
          aria-label={question.prompt}
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
  quiz
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
