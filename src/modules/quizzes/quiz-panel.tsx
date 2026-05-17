"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { initialQuizActionState } from "@/modules/quizzes/action-state"
import {
  deleteQuestion,
  gradeQuizAnswer,
  saveExam,
  saveQuestion,
  saveQuiz,
  submitQuiz,
} from "@/modules/quizzes/actions"
import { getQuizAttemptStatus, shouldShowQuizResults } from "@/modules/quizzes/status"
import {
  EmptyState,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"

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
      {mode === "instructor" ? <QuizForm classSectionId={classSectionId} /> : null}
      <SimpleTable
        empty="No quizzes yet."
        headers={
          mode === "instructor"
            ? ["Quiz", "Open", "Close", "Published", "Questions", "Attempts", "Graded", "Manage"]
            : ["Quiz", "Open", "Close", "Status", "Score", "Open"]
        }
        rows={quizzes.map((quiz) => {
          const ownAttempts = quiz.attempts.filter((attempt) => attempt.studentId === userId)
          const latestAttempt = ownAttempts[0]
          const gradedCount = quiz.attempts.filter((attempt) => getQuizAttemptStatus(attempt) === "Graded").length

          return (
            <TableRow key={quiz.id}>
              <TableCell className="font-medium">{quiz.title}</TableCell>
              <TableCell>{formatDateTime(quiz.opensAt)}</TableCell>
              <TableCell>{formatDateTime(quiz.closesAt)}</TableCell>
              {mode === "instructor" ? (
                <>
                  <TableCell>{quiz.isPublished ? "Published" : "Draft"}</TableCell>
                  <TableCell>{quiz.questions.length}</TableCell>
                  <TableCell>{quiz.attempts.length}</TableCell>
                  <TableCell>{gradedCount}</TableCell>
                  <TableCell>
                    <details className="min-w-[280px]">
                      <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">Manage</summary>
                      <div className="mt-3 space-y-4 rounded-md border bg-background p-3">
                        <QuizForm classSectionId={classSectionId} quiz={quiz} />
                        <QuestionForm quizId={quiz.id} />
                        <QuestionList quiz={quiz} />
                        <AttemptReview quiz={quiz} />
                      </div>
                    </details>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell>{latestAttempt ? getQuizAttemptStatus(latestAttempt) : availabilityLabel(quiz, now)}</TableCell>
                  <TableCell>
                    {latestAttempt && shouldShowQuizResults(quiz)
                      ? `${latestAttempt.score ?? "0"}/${quiz.pointsPossible ?? totalPoints(quiz)}`
                      : latestAttempt
                        ? "Results hidden"
                        : "-"}
                  </TableCell>
                  <TableCell>
                    <details className="min-w-[280px]">
                      <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">Open</summary>
                      <div className="mt-3 space-y-3 rounded-md border bg-background p-3">
                        {quiz.description ? <p className="text-sm text-muted-foreground">{quiz.description}</p> : null}
                        {latestAttempt && shouldShowQuizResults(quiz) ? (
                          <StudentResult quiz={quiz} attempt={latestAttempt} />
                        ) : latestAttempt ? (
                          <p className="text-sm text-muted-foreground">Results are not available yet.</p>
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

function QuizForm({ classSectionId, quiz }: { classSectionId: string; quiz?: QuizPanelValue }) {
  const [state, formAction, pending] = useActionState(saveQuiz, initialQuizActionState)
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={quiz?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <label className="grid gap-1 text-sm"><span className="font-medium">Title</span><Input name="title" required defaultValue={quiz?.title ?? ""} /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Opens at</span><Input name="opensAt" type="datetime-local" defaultValue={toLocalInputDate(quiz?.opensAt)} /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Closes at</span><Input name="closesAt" type="datetime-local" defaultValue={toLocalInputDate(quiz?.closesAt)} /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Time limit</span><Input name="timeLimitMinutes" type="number" min="1" defaultValue={quiz?.timeLimitMinutes ?? ""} /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Max attempts</span><Input name="maxAttempts" type="number" min="1" defaultValue={quiz?.maxAttempts ?? "1"} /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Points possible</span><Input name="pointsPossible" type="number" min="0" step="0.01" defaultValue={quiz?.pointsPossible ?? ""} /></label>
      <label className="flex items-end gap-2 text-sm"><input name="isPublished" type="checkbox" defaultChecked={quiz?.isPublished ?? false} /> Published</label>
      <label className="flex items-end gap-2 text-sm"><input name="showResultsToStudents" type="checkbox" defaultChecked={quiz?.showResultsToStudents ?? true} /> Show results</label>
      <label className="flex items-end gap-2 text-sm"><input name="shuffleQuestions" type="checkbox" defaultChecked={quiz?.shuffleQuestions ?? false} /> Shuffle questions</label>
      <label className="grid gap-1 text-sm md:col-span-2 xl:col-span-4"><span className="font-medium">Description</span><Textarea name="description" rows={3} defaultValue={quiz?.description ?? ""} /></label>
      <ActionMessage state={state} />
      <div className="flex items-end"><Button size="sm" type="submit" disabled={pending}>{pending ? "Saving..." : quiz ? "Save quiz" : "Create quiz"}</Button></div>
    </form>
  )
}

function QuestionForm({ question, quizId }: { question?: QuestionValue; quizId: string }) {
  const [state, formAction, pending] = useActionState(saveQuestion, initialQuizActionState)
  const [type, setType] = useState<QuestionType>(question?.type ?? "MULTIPLE_CHOICE")
  const key = question?.answerKey as { correctOptionIndex?: number; correctBoolean?: boolean; acceptedAnswers?: string[] } | null
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={question?.id ?? ""} />
      <input name="quizId" type="hidden" value={quizId} />
      <label className="grid gap-1 text-sm"><span className="font-medium">Type</span><select className="h-9 rounded-md border bg-background px-3 text-sm" name="type" value={type} onChange={(event) => setType(event.target.value as QuestionType)}>{["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Order</span><Input name="sequence" type="number" min="1" defaultValue={question?.sequence ?? 1} /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Points</span><Input name="points" type="number" min="0" step="0.01" defaultValue={question?.points ?? "1"} /></label>
      <label className="grid gap-1 text-sm md:col-span-2 xl:col-span-4"><span className="font-medium">Prompt</span><Textarea name="prompt" required rows={3} defaultValue={question?.prompt ?? ""} /></label>
      {type === "MULTIPLE_CHOICE" ? (
        <div className="grid gap-2 md:col-span-2 xl:col-span-4">
          {[0, 1, 2, 3].map((index) => <Input key={index} name={`option${index}`} placeholder={`Option ${index + 1}`} defaultValue={question?.options[index]?.text ?? ""} />)}
          <label className="grid gap-1 text-sm"><span className="font-medium">Correct option</span><select className="h-9 rounded-md border bg-background px-3 text-sm" name="correctOptionIndex" defaultValue={key?.correctOptionIndex ?? 0}>{[0, 1, 2, 3].map((index) => <option key={index} value={index}>Option {index + 1}</option>)}</select></label>
        </div>
      ) : null}
      {type === "TRUE_FALSE" ? <label className="grid gap-1 text-sm"><span className="font-medium">Correct answer</span><select className="h-9 rounded-md border bg-background px-3 text-sm" name="trueFalseAnswer" defaultValue={String(key?.correctBoolean ?? true)}><option value="true">True</option><option value="false">False</option></select></label> : null}
      {type === "SHORT_ANSWER" ? <label className="grid gap-1 text-sm md:col-span-2"><span className="font-medium">Accepted answers</span><Textarea name="acceptedAnswers" rows={2} defaultValue={(key?.acceptedAnswers ?? []).join(", ")} /></label> : null}
      <ActionMessage state={state} />
      <div className="flex items-end"><Button size="sm" type="submit" disabled={pending}>{pending ? "Saving..." : question ? "Save question" : "Add question"}</Button></div>
    </form>
  )
}

function QuestionList({ quiz }: { quiz: QuizPanelValue }) {
  return <div className="space-y-3"><h4 className="text-sm font-medium">Questions</h4>{quiz.questions.map((question) => <details className="rounded-md border p-3" key={question.id}><summary className="cursor-pointer text-sm font-medium">{question.sequence}. {question.prompt}</summary><div className="mt-3 space-y-3"><QuestionForm quizId={quiz.id} question={question} /><DeleteQuestionForm questionId={question.id} /></div></details>)}</div>
}

function DeleteQuestionForm({ questionId }: { questionId: string }) {
  const [state, formAction, pending] = useActionState(deleteQuestion, initialQuizActionState)
  return <form action={formAction} className="space-y-2"><input name="questionId" type="hidden" value={questionId} /><ActionMessage state={state} /><Button size="sm" type="submit" variant="destructive" disabled={pending}>Delete question</Button></form>
}

function QuizAttemptForm({ quiz, now }: { quiz: QuizPanelValue; now: string }) {
  const [state, formAction, pending] = useActionState(submitQuiz, initialQuizActionState)
  const blocked = availabilityLabel(quiz, now) !== "Available"
  return <form action={formAction} className="space-y-4"><input name="quizId" type="hidden" value={quiz.id} />{quiz.questions.map((question) => <QuestionInput key={question.id} question={question} />)}<ActionMessage state={state} />{blocked ? <p className="text-sm text-destructive">{availabilityLabel(quiz, now)}</p> : null}<Button size="sm" type="submit" disabled={pending || blocked}>{pending ? "Submitting..." : "Submit quiz"}</Button></form>
}

function QuestionInput({ question }: { question: QuestionValue }) {
  return <div className="space-y-2 rounded-md border p-3"><div className="text-sm font-medium">{question.prompt} <span className="text-muted-foreground">({question.points} pts)</span></div>{question.type === "MULTIPLE_CHOICE" ? question.options.map((option) => <label className="flex gap-2 text-sm" key={option.id}><input name={`answer_${question.id}`} type="radio" value={option.id} required />{option.text}</label>) : null}{question.type === "TRUE_FALSE" ? <div className="flex gap-4"><label className="flex gap-2 text-sm"><input name={`answer_${question.id}`} type="radio" value="true" required />True</label><label className="flex gap-2 text-sm"><input name={`answer_${question.id}`} type="radio" value="false" required />False</label></div> : null}{["SHORT_ANSWER", "ESSAY"].includes(question.type) ? <Textarea name={`answer_${question.id}`} required rows={question.type === "ESSAY" ? 5 : 2} /> : null}</div>
}

function AttemptReview({ quiz }: { quiz: QuizPanelValue }) {
  if (!quiz.attempts.length) return <EmptyState>No attempts yet.</EmptyState>
  return <div className="space-y-3"><h4 className="text-sm font-medium">Attempts</h4>{quiz.attempts.map((attempt) => <details className="rounded-md border p-3" key={attempt.id}><summary className="cursor-pointer text-sm font-medium">{attempt.studentName} - {getQuizAttemptStatus(attempt)} - {attempt.score ?? "0"}/{quiz.pointsPossible ?? totalPoints(quiz)}</summary><SimpleTable empty="No answers." headers={["Question", "Answer", "Score", "Feedback", "Grade"]} rows={attempt.answers.map((answer) => <TableRow key={answer.id}><TableCell className="font-medium">{answer.questionPrompt}</TableCell><TableCell>{answer.selectedOptionText ?? answer.answerText ?? "-"}</TableCell><TableCell>{answer.score ?? "-"}/{answer.questionPoints}</TableCell><TableCell>{answer.feedback ?? "-"}</TableCell><TableCell>{["ESSAY", "SHORT_ANSWER"].includes(answer.questionType) ? <GradeAnswerForm answer={answer} /> : "Auto"}</TableCell></TableRow>)} /></details>)}</div>
}

function GradeAnswerForm({ answer }: { answer: AnswerValue }) {
  const [state, formAction, pending] = useActionState(gradeQuizAnswer, initialQuizActionState)
  return <form action={formAction} className="min-w-[220px] space-y-2"><input name="answerId" type="hidden" value={answer.id} /><Input name="score" type="number" min="0" max={answer.questionPoints} step="0.01" defaultValue={answer.score ?? ""} /><Textarea name="feedback" rows={2} defaultValue={answer.feedback ?? ""} /><ActionMessage state={state} /><Button size="sm" type="submit" variant="outline" disabled={pending}>Save</Button></form>
}

function StudentResult({ attempt, quiz }: { attempt: AttemptValue; quiz: QuizPanelValue }) {
  return <div className="space-y-3"><p className="text-sm font-medium">Score: {attempt.score ?? "0"}/{quiz.pointsPossible ?? totalPoints(quiz)}</p><SimpleTable empty="No answers." headers={["Question", "Answer", "Score", "Feedback"]} rows={attempt.answers.map((answer) => <TableRow key={answer.id}><TableCell>{answer.questionPrompt}</TableCell><TableCell>{answer.selectedOptionText ?? answer.answerText ?? "-"}</TableCell><TableCell>{answer.score ?? "-"}/{answer.questionPoints}</TableCell><TableCell>{answer.feedback ?? "-"}</TableCell></TableRow>)} /></div>
}

export function ExamPanel({ classSectionId, exams }: { classSectionId: string; exams: ExamPanelValue[] }) {
  return <section className="space-y-4"><h3 className="text-base font-semibold">Exams</h3><ExamForm classSectionId={classSectionId} /><SimpleTable empty="No exams yet." headers={["Title", "Type", "Starts", "Ends", "Max score", "Location"]} rows={exams.map((exam) => <TableRow key={exam.id}><TableCell className="font-medium">{exam.title}</TableCell><TableCell>{exam.examType ?? "CUSTOM"}</TableCell><TableCell>{formatDateTime(exam.startsAt)}</TableCell><TableCell>{formatDateTime(exam.endsAt)}</TableCell><TableCell>{exam.pointsPossible ?? "-"}</TableCell><TableCell>{exam.location ?? "-"}</TableCell></TableRow>)} /></section>
}

function ExamForm({ classSectionId }: { classSectionId: string }) {
  const [state, formAction, pending] = useActionState(saveExam, initialQuizActionState)
  return <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input name="classSectionId" type="hidden" value={classSectionId} /><label className="grid gap-1 text-sm"><span className="font-medium">Title</span><Input name="title" required /></label><label className="grid gap-1 text-sm"><span className="font-medium">Type</span><select className="h-9 rounded-md border bg-background px-3 text-sm" name="examType" defaultValue="CUSTOM">{["MIDTERM", "FINAL", "PRACTICAL", "ORAL", "CUSTOM"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="grid gap-1 text-sm"><span className="font-medium">Starts at</span><Input name="startsAt" type="datetime-local" /></label><label className="grid gap-1 text-sm"><span className="font-medium">Ends at</span><Input name="endsAt" type="datetime-local" /></label><label className="grid gap-1 text-sm"><span className="font-medium">Location</span><Input name="location" /></label><label className="grid gap-1 text-sm"><span className="font-medium">Max score</span><Input name="pointsPossible" type="number" min="0" step="0.01" /></label><label className="grid gap-1 text-sm"><span className="font-medium">Weight</span><Input name="weight" type="number" min="0" step="0.01" /></label><label className="grid gap-1 text-sm md:col-span-2 xl:col-span-4"><span className="font-medium">Description</span><Textarea name="description" rows={2} /></label><ActionMessage state={state} /><div className="flex items-end"><Button size="sm" type="submit" disabled={pending}>{pending ? "Saving..." : "Create exam"}</Button></div></form>
}

function ActionMessage({ state }: { state: { ok: boolean; message: string } }) {
  return state.message ? <p className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`} role="status">{state.message}</p> : null
}

function availabilityLabel(quiz: QuizPanelValue, now: string) {
  const current = new Date(now).getTime()
  if (!quiz.isPublished) return "Not published"
  if (quiz.opensAt && new Date(quiz.opensAt).getTime() > current) return "Not open yet"
  if (quiz.closesAt && new Date(quiz.closesAt).getTime() < current) return "Closed"
  return "Available"
}

function totalPoints(quiz: QuizPanelValue) {
  return quiz.questions.reduce((total, question) => total + Number(question.points), 0).toFixed(2)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}

function toLocalInputDate(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
