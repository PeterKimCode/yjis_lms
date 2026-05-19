"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useActionState, useState } from "react"

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
  deleteQuestion,
  gradeQuizAnswer,
  saveExam,
  saveQuestion,
  saveQuiz,
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
        <details className="rounded-md border bg-background p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Create quiz
          </summary>
          <div className="pt-3">
            <QuizForm classSectionId={classSectionId} />
          </div>
        </details>
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
}: {
  classSectionId: string
  quiz: QuizPanelValue
}) {
  return (
    <div className="space-y-6">
      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer text-lg font-semibold">
          Quiz settings/edit
        </summary>
        <div className="pt-4">
          <QuizForm classSectionId={classSectionId} quiz={quiz} />
        </div>
      </details>

      <section className="space-y-4 rounded-lg border bg-background p-4">
        <div>
          <h2 className="text-lg font-semibold">Questions</h2>
          <p className="text-sm text-muted-foreground">
            Add auto-graded multiple-choice, true/false, and short-answer
            questions, or use essay questions for manual grading.
          </p>
        </div>
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Add question
          </summary>
          <div className="pt-3">
            <QuestionForm quizId={quiz.id} />
          </div>
        </details>
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Existing questions / edit questions
          </summary>
          <div className="pt-3">
            <QuestionList quiz={quiz} />
          </div>
        </details>
      </section>

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

function QuizForm({
  classSectionId,
  quiz,
}: {
  classSectionId: string
  quiz?: QuizPanelValue
}) {
  const [state, formAction, pending] = useActionState(
    saveQuiz,
    initialQuizActionState
  )

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={quiz?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <Field label="Title" help="Students will see this quiz title.">
        <Input
          name="title"
          required
          placeholder="Example: Week 1 Check Quiz"
          defaultValue={quiz?.title ?? ""}
        />
      </Field>
      <Field
        label="Opens at"
        help="Students cannot start before this time. Leave blank to open immediately."
      >
        <Input
          name="opensAt"
          type="datetime-local"
          defaultValue={toLocalInputDate(quiz?.opensAt)}
        />
      </Field>
      <Field
        label="Closes at"
        help="Students cannot submit after this time unless you later add an override policy."
      >
        <Input
          name="closesAt"
          type="datetime-local"
          defaultValue={toLocalInputDate(quiz?.closesAt)}
        />
      </Field>
      <Field
        label="Time limit (minutes)"
        help="Optional. Enter minutes. Leave blank for no time limit."
      >
        <Input
          inputMode="numeric"
          min="1"
          name="timeLimitMinutes"
          placeholder="Example: 30"
          step="1"
          type="number"
          defaultValue={quiz?.timeLimitMinutes ?? ""}
        />
      </Field>
      <Field
        label="Maximum attempts"
        help="How many times a student can take this quiz."
      >
        <Input
          inputMode="numeric"
          min="1"
          name="maxAttempts"
          placeholder="Example: 1"
          step="1"
          type="number"
          defaultValue={quiz?.maxAttempts ?? "1"}
        />
      </Field>
      <Field label="Points possible" help="Optional total shown for this quiz.">
        <Input
          inputMode="decimal"
          min="0"
          name="pointsPossible"
          placeholder="Example: 100"
          step="0.5"
          type="number"
          defaultValue={quiz?.pointsPossible ?? ""}
        />
      </Field>
      <CheckField
        name="isPublished"
        label="Published"
        help="Only published quizzes are visible to students."
        defaultChecked={quiz?.isPublished ?? false}
      />
      <CheckField
        name="showResultsToStudents"
        label="Show results"
        help="Students can see scores and answer feedback after submitting."
        defaultChecked={quiz?.showResultsToStudents ?? true}
      />
      <CheckField
        name="shuffleQuestions"
        label="Shuffle questions"
        help="Reserved for randomized delivery as quiz features grow."
        defaultChecked={quiz?.shuffleQuestions ?? false}
      />
      <Field
        label="Description"
        help="Briefly describe what this quiz covers."
        className="md:col-span-2 xl:col-span-4"
      >
        <Textarea
          name="description"
          rows={3}
          placeholder="Describe what this quiz covers."
          defaultValue={quiz?.description ?? ""}
        />
      </Field>
      <ActionMessage state={state} />
      <div className="flex items-end">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : quiz ? "Save quiz" : "Create quiz"}
        </Button>
      </div>
    </form>
  )
}

function QuestionForm({
  question,
  quizId,
}: {
  question?: QuestionValue
  quizId: string
}) {
  const [state, formAction, pending] = useActionState(
    saveQuestion,
    initialQuizActionState
  )
  const [type, setType] = useState<QuestionType>(
    question?.type ?? "MULTIPLE_CHOICE"
  )
  const key = question?.answerKey as {
    correctOptionIndex?: number
    correctBoolean?: boolean
    acceptedAnswers?: string[]
  } | null

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={question?.id ?? ""} />
      <input name="quizId" type="hidden" value={quizId} />
      <Field
        label="Question type"
        help="Choose how this question will be answered and graded."
      >
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as QuestionType)}
        >
          {["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"].map(
            (item) => (
              <option key={item} value={item}>
                {item}
              </option>
            )
          )}
        </select>
      </Field>
      <Field label="Display order" help="Lower numbers appear first.">
        <Input
          inputMode="numeric"
          min="1"
          name="sequence"
          placeholder="Example: 1"
          step="1"
          type="number"
          defaultValue={question?.sequence ?? 1}
        />
      </Field>
      <Field
        label="Points"
        help="Score awarded for a correct answer or manual grade."
      >
        <Input
          inputMode="decimal"
          min="0"
          name="points"
          placeholder="Example: 10"
          step="0.5"
          type="number"
          defaultValue={question?.points ?? "1"}
        />
      </Field>
      <Field
        label="Prompt"
        help="Enter the question students will answer."
        className="md:col-span-2 xl:col-span-4"
      >
        <Textarea
          name="prompt"
          required
          rows={3}
          placeholder="Enter the question students will answer."
          defaultValue={question?.prompt ?? ""}
        />
      </Field>
      <Field
        label="Explanation"
        help="Optional explanation shown after grading, if results are visible."
        className="md:col-span-2 xl:col-span-4"
      >
        <Textarea
          name="explanation"
          rows={2}
          placeholder="Optional explanation shown after grading, if results are visible."
          defaultValue={question?.explanation ?? ""}
        />
      </Field>
      {type === "MULTIPLE_CHOICE" ? (
        <div className="grid gap-3 md:col-span-2 xl:col-span-4">
          <p className="text-xs text-muted-foreground">
            Select the correct option. For now, at least one correct answer is
            required.
          </p>
          {[
            "Example: VideoProgress",
            "Example: User",
            "Example: Course",
            "Example: AttendanceRecord",
          ].map((placeholder, index) => (
            <Input
              key={index}
              name={`option${index}`}
              placeholder={placeholder}
              defaultValue={question?.options[index]?.text ?? ""}
            />
          ))}
          <Field label="Correct answer" help="Choose the option that is correct.">
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              name="correctOptionIndex"
              defaultValue={key?.correctOptionIndex ?? 0}
            >
              {[0, 1, 2, 3].map((index) => (
                <option key={index} value={index}>
                  Option {index + 1}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}
      {type === "TRUE_FALSE" ? (
        <Field label="Correct answer" help="True/false questions are auto-graded.">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            name="trueFalseAnswer"
            defaultValue={String(key?.correctBoolean ?? true)}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </Field>
      ) : null}
      {type === "SHORT_ANSWER" ? (
        <Field
          label="Accepted answer"
          help="Exact match is used for simple auto-grading."
          className="md:col-span-2"
        >
          <Textarea
            name="acceptedAnswers"
            rows={2}
            placeholder="Example: VideoProgress"
            defaultValue={(key?.acceptedAnswers ?? []).join(", ")}
          />
        </Field>
      ) : null}
      {type === "ESSAY" ? (
        <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
          Essay questions are manually graded by the instructor.
        </p>
      ) : null}
      <ActionMessage state={state} />
      <div className="flex items-end">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : question ? "Save question" : "Add question"}
        </Button>
      </div>
    </form>
  )
}

function QuestionList({ quiz }: { quiz: QuizPanelValue }) {
  if (!quiz.questions.length) {
    return <EmptyState>No questions yet.</EmptyState>
  }

  return (
    <div className="space-y-3">
      {quiz.questions.map((question) => (
        <details className="rounded-md border p-3" key={question.id}>
          <summary className="cursor-pointer text-sm font-medium">
            {question.sequence}. {question.prompt}
          </summary>
          <div className="mt-3 space-y-3">
            <QuestionForm quizId={quiz.id} question={question} />
            <DeleteQuestionForm questionId={question.id} />
          </div>
        </details>
      ))}
    </div>
  )
}

function DeleteQuestionForm({ questionId }: { questionId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteQuestion,
    initialQuizActionState
  )

  return (
    <form action={formAction} className="space-y-2">
      <input name="questionId" type="hidden" value={questionId} />
      <ActionMessage state={state} />
      <Button size="sm" type="submit" variant="destructive" disabled={pending}>
        Delete question
      </Button>
    </form>
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
      <ActionMessage state={state} />
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
      <ActionMessage state={state} />
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
      <details className="rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Create exam
        </summary>
        <div className="pt-3">
          <ExamForm classSectionId={classSectionId} />
        </div>
      </details>
      <SimpleTable
        empty="No exams yet."
        headers={["Title", "Type", "Starts", "Ends", "Max score", "Location"]}
        rows={exams.map((exam) => (
          <TableRow key={exam.id}>
            <TableCell className="font-medium">{exam.title}</TableCell>
            <TableCell>{exam.examType ?? "CUSTOM"}</TableCell>
            <TableCell>{formatDateTime(exam.startsAt)}</TableCell>
            <TableCell>{formatDateTime(exam.endsAt)}</TableCell>
            <TableCell>{exam.pointsPossible ?? "-"}</TableCell>
            <TableCell>{exam.location ?? "-"}</TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function ExamForm({ classSectionId }: { classSectionId: string }) {
  const [state, formAction, pending] = useActionState(
    saveExam,
    initialQuizActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <Field label="Title">
        <Input name="title" required placeholder="Example: Midterm exam" />
      </Field>
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
      </Field>
      <Field label="Starts at">
        <Input name="startsAt" type="datetime-local" />
      </Field>
      <Field label="Ends at">
        <Input name="endsAt" type="datetime-local" />
      </Field>
      <Field label="Location">
        <Input name="location" placeholder="Room 101 or online" />
      </Field>
      <Field label="Max score">
        <Input
          inputMode="decimal"
          min="0"
          name="pointsPossible"
          step="0.5"
          type="number"
        />
      </Field>
      <Field label="Weight">
        <Input
          inputMode="decimal"
          min="0"
          name="weight"
          step="0.5"
          type="number"
        />
      </Field>
      <Field label="Description" className="md:col-span-2 xl:col-span-4">
        <Textarea name="description" rows={2} />
      </Field>
      <ActionMessage state={state} />
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

function CheckField({
  defaultChecked,
  help,
  label,
  name,
}: {
  defaultChecked: boolean
  help: string
  label: string
  name: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <input name={name} type="checkbox" defaultChecked={defaultChecked} />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{help}</span>
    </label>
  )
}

function ActionMessage({ state }: { state: { ok: boolean; message: string } }) {
  return state.message ? (
    <p
      className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.message}
    </p>
  ) : null
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

function toLocalInputDate(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
