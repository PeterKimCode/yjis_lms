"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  EmptyState,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { initialGradebookActionState } from "@/modules/grades/action-state"
import {
  calculateFinalGrades,
  deleteGradeCategory,
  deleteGradeItem,
  finalizeFinalGrades,
  generateTranscriptsForClassSection,
  publishFinalGrades,
  saveGradeCategory,
  saveGradeItem,
  saveGradeScore,
} from "@/modules/grades/actions"
import { isGradeVisibleToStudents } from "@/modules/grades/status"

export type GradebookPanelValue = {
  categories: GradeCategoryValue[]
  enrollments: GradebookStudentValue[]
  finalGrades: FinalGradeValue[]
  gradeItems: GradeItemValue[]
  sourceOptions: GradeSourceOptions
}

export type GradeCategoryValue = {
  id: string
  name: string
  weight: string | null
  sequence: number
}

export type GradeItemValue = {
  id: string
  categoryId: string | null
  title: string
  pointsPossible: string
  weight: string | null
  dueAt: string | null
  assignmentId: string | null
  quizId: string | null
  examId: string | null
  scores: GradeScoreValue[]
}

export type GradeScoreValue = {
  id: string
  studentId: string
  score: string | null
  percentage: string | null
  feedback: string | null
  gradedAt: string | null
}

export type FinalGradeValue = {
  id: string
  studentId: string
  numericScore: string | null
  percentage: string | null
  letterGrade: string | null
  gradePoint: string | null
  creditsEarned: string | null
  status: string
}

export type GradebookStudentValue = {
  id: string
  name: string
  email: string | null
}

export type GradeSourceOptions = {
  assignments: { id: string; title: string }[]
  quizzes: { id: string; title: string }[]
  exams: { id: string; title: string }[]
}

export function GradebookPanel({
  classSectionId,
  mode,
  value,
  userId,
}: {
  classSectionId: string
  mode: "instructor" | "student"
  value: GradebookPanelValue
  userId: string
}) {
  if (mode === "student") {
    const visibleGrades = value.finalGrades.filter(
      (grade) => grade.studentId === userId && isGradeVisibleToStudents(grade.status)
    )

    return visibleGrades.length ? (
      <SimpleTable
        empty="Grades are not published yet."
        headers={["Final score", "Letter", "Grade point", "Credit earned", "Status"]}
        rows={visibleGrades.map((grade) => (
          <TableRow key={grade.id}>
            <TableCell>{grade.percentage ?? grade.numericScore ?? "-"}</TableCell>
            <TableCell className="font-medium">{grade.letterGrade ?? "-"}</TableCell>
            <TableCell>{grade.gradePoint ?? "-"}</TableCell>
            <TableCell>{grade.creditsEarned ?? "0"}</TableCell>
            <TableCell>{grade.status}</TableCell>
          </TableRow>
        ))}
      />
    ) : (
      <EmptyState>Grades are not published yet.</EmptyState>
    )
  }

  const totalWeight = value.categories.reduce(
    (total, category) => total + Number(category.weight ?? 0),
    0
  )

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-background p-3 text-sm">
        <span className="font-medium">Category weight total:</span>{" "}
        {totalWeight.toFixed(1)}%
        {Math.round(totalWeight * 10) / 10 !== 100 ? (
          <p className="mt-1 text-xs text-destructive">
            Category weights total {totalWeight.toFixed(1)}%. Final grade
            calculation expects 100%.
          </p>
        ) : null}
      </div>

      <details className="rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Grade categories
        </summary>
        <div className="space-y-4 pt-3">
          <GradeCategoryForm classSectionId={classSectionId} />
          <SimpleTable
            empty="No grade categories yet."
            headers={["Order", "Name", "Weight", "Edit"]}
            rows={value.categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.sequence}</TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.weight ?? "0"}%</TableCell>
                <TableCell>
                  <details className="min-w-[260px]">
                    <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">
                      Edit
                    </summary>
                    <div className="mt-3 space-y-3 rounded-md border p-3">
                      <GradeCategoryForm
                        category={category}
                        classSectionId={classSectionId}
                      />
                      <DeleteCategoryForm categoryId={category.id} />
                    </div>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          />
        </div>
      </details>

      <details className="rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Grade items
        </summary>
        <div className="space-y-4 pt-3">
          <GradeItemForm
            categories={value.categories}
            classSectionId={classSectionId}
            sourceOptions={value.sourceOptions}
          />
          <GradeItemList
            categories={value.categories}
            items={value.gradeItems}
            sourceOptions={value.sourceOptions}
            classSectionId={classSectionId}
          />
        </div>
      </details>

      <details className="rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Score entry
        </summary>
        <div className="space-y-4 pt-3">
          {value.gradeItems.length ? (
            value.gradeItems.map((item) => (
              <details className="rounded-md border p-3" key={item.id}>
                <summary className="cursor-pointer text-sm font-medium">
                  {item.title} ({item.pointsPossible} pts)
                </summary>
                <div className="pt-3">
                  <ScoreEntryTable item={item} students={value.enrollments} />
                </div>
              </details>
            ))
          ) : (
            <EmptyState>Create grade items before entering scores.</EmptyState>
          )}
        </div>
      </details>

      <details className="rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Final grades
        </summary>
        <div className="space-y-4 pt-3">
          <FinalGradeActions classSectionId={classSectionId} />
          <SimpleTable
            empty="No final grades calculated yet."
            headers={[
              "Student",
              "Final score",
              "Letter",
              "Grade point",
              "Credit earned",
              "Status",
            ]}
            rows={value.finalGrades.map((grade) => {
              const student = value.enrollments.find(
                (entry) => entry.id === grade.studentId
              )
              return (
                <TableRow key={grade.id}>
                  <TableCell className="font-medium">
                    {student?.name ?? "Unknown student"}
                  </TableCell>
                  <TableCell>{grade.percentage ?? grade.numericScore ?? "-"}</TableCell>
                  <TableCell>{grade.letterGrade ?? "-"}</TableCell>
                  <TableCell>{grade.gradePoint ?? "-"}</TableCell>
                  <TableCell>{grade.creditsEarned ?? "0"}</TableCell>
                  <TableCell>{grade.status}</TableCell>
                </TableRow>
              )
            })}
          />
        </div>
      </details>

      <details className="rounded-md border bg-background p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Transcript/GPA
        </summary>
        <div className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Generates transcript terms and GPA from published or finalized final
            grades. Attempted credits include failed courses; earned credits
            count passed courses only.
          </p>
          <TranscriptForm classSectionId={classSectionId} />
        </div>
      </details>
    </div>
  )
}

function GradeCategoryForm({
  category,
  classSectionId,
}: {
  category?: GradeCategoryValue
  classSectionId: string
}) {
  const [state, formAction, pending] = useActionState(
    saveGradeCategory,
    initialGradebookActionState
  )

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={category?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Name</span>
        <Input name="name" required placeholder="Assignments" defaultValue={category?.name ?? ""} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Category weight</span>
        <Input
          inputMode="decimal"
          max="100"
          min="0"
          name="weight"
          placeholder="Example: 20 for 20%"
          step="0.5"
          type="number"
          defaultValue={category?.weight ?? "0"}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Order</span>
        <Input
          inputMode="numeric"
          min="1"
          name="sequence"
          step="1"
          type="number"
          defaultValue={category?.sequence ?? 1}
        />
      </label>
      <ActionMessage state={state} />
      <div className="flex items-end">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : category ? "Save category" : "Create category"}
        </Button>
      </div>
    </form>
  )
}

function DeleteCategoryForm({ categoryId }: { categoryId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteGradeCategory,
    initialGradebookActionState
  )

  return (
    <form action={formAction} className="space-y-2">
      <input name="categoryId" type="hidden" value={categoryId} />
      <ActionMessage state={state} />
      <Button size="sm" type="submit" variant="destructive" disabled={pending}>
        Delete category
      </Button>
    </form>
  )
}

function GradeItemForm({
  categories,
  classSectionId,
  item,
  sourceOptions,
}: {
  categories: GradeCategoryValue[]
  classSectionId: string
  item?: GradeItemValue
  sourceOptions: GradeSourceOptions
}) {
  const [state, formAction, pending] = useActionState(
    saveGradeItem,
    initialGradebookActionState
  )
  const sourceType = item?.assignmentId
    ? "ASSIGNMENT"
    : item?.quizId
      ? "QUIZ"
      : item?.examId
        ? "EXAM"
        : "CUSTOM"
  const sourceId = item?.assignmentId ?? item?.quizId ?? item?.examId ?? ""

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input name="id" type="hidden" value={item?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Title</span>
        <Input name="title" required placeholder="Assignment 1" defaultValue={item?.title ?? ""} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Category</span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="categoryId"
          defaultValue={item?.categoryId ?? ""}
        >
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Source type</span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="sourceType"
          defaultValue={sourceType}
        >
          {["CUSTOM", "ATTENDANCE", "ASSIGNMENT", "QUIZ", "EXAM"].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Source item</span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="sourceId"
          defaultValue={sourceId}
        >
          <option value="">None / custom</option>
          <optgroup label="Assignments">
            {sourceOptions.assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Quizzes">
            {sourceOptions.quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="Exams">
            {sourceOptions.exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Max score</span>
        <Input
          inputMode="decimal"
          min="0.01"
          name="pointsPossible"
          placeholder="Example: 100"
          step="0.5"
          type="number"
          defaultValue={item?.pointsPossible ?? "100"}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Item weight</span>
        <Input
          inputMode="decimal"
          min="0"
          name="weight"
          placeholder="Optional"
          step="0.5"
          type="number"
          defaultValue={item?.weight ?? ""}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Due/occurred at</span>
        <Input name="dueAt" type="datetime-local" defaultValue={toLocalInputDate(item?.dueAt)} />
      </label>
      <ActionMessage state={state} />
      <div className="flex items-end">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : item ? "Save item" : "Create item"}
        </Button>
      </div>
    </form>
  )
}

function GradeItemList({
  categories,
  classSectionId,
  items,
  sourceOptions,
}: {
  categories: GradeCategoryValue[]
  classSectionId: string
  items: GradeItemValue[]
  sourceOptions: GradeSourceOptions
}) {
  if (!items.length) return <EmptyState>No grade items yet.</EmptyState>

  return (
    <div className="space-y-3">
      {[...categories, { id: "", name: "Uncategorized", weight: null, sequence: 999 }].map(
        (category) => {
          const categoryItems = items.filter(
            (item) => (item.categoryId ?? "") === category.id
          )
          if (!categoryItems.length) return null

          return (
            <details className="rounded-md border p-3" key={category.id || "none"}>
              <summary className="cursor-pointer text-sm font-medium">
                {category.name}
              </summary>
              <SimpleTable
                empty="No grade items."
                headers={["Title", "Max", "Weight", "Due", "Scores", "Edit"]}
                rows={categoryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.pointsPossible}</TableCell>
                    <TableCell>{item.weight ?? "-"}</TableCell>
                    <TableCell>{formatDateTime(item.dueAt)}</TableCell>
                    <TableCell>{item.scores.length}</TableCell>
                    <TableCell>
                      <details className="min-w-[260px]">
                        <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">
                          Edit
                        </summary>
                        <div className="mt-3 space-y-3 rounded-md border p-3">
                          <GradeItemForm
                            categories={categories}
                            classSectionId={classSectionId}
                            item={item}
                            sourceOptions={sourceOptions}
                          />
                          <DeleteGradeItemForm gradeItemId={item.id} />
                        </div>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              />
            </details>
          )
        }
      )}
    </div>
  )
}

function DeleteGradeItemForm({ gradeItemId }: { gradeItemId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteGradeItem,
    initialGradebookActionState
  )

  return (
    <form action={formAction} className="space-y-2">
      <input name="gradeItemId" type="hidden" value={gradeItemId} />
      <ActionMessage state={state} />
      <Button size="sm" type="submit" variant="destructive" disabled={pending}>
        Delete item
      </Button>
    </form>
  )
}

function ScoreEntryTable({
  item,
  students,
}: {
  item: GradeItemValue
  students: GradebookStudentValue[]
}) {
  return (
    <SimpleTable
      empty="No enrolled students."
      headers={["Student", "Email", "Current score", "Feedback", "Save"]}
      rows={students.map((student) => {
        const score = item.scores.find((entry) => entry.studentId === student.id)
        const formId = `score-${item.id}-${student.id}`

        return (
          <TableRow key={student.id}>
            <TableCell className="font-medium">{student.name}</TableCell>
            <TableCell>{student.email ?? "-"}</TableCell>
            <ScoreEntryCells
              formId={formId}
              item={item}
              score={score}
              studentId={student.id}
            />
          </TableRow>
        )
      })}
    />
  )
}

function ScoreEntryCells({
  formId,
  item,
  score,
  studentId,
}: {
  formId: string
  item: GradeItemValue
  score?: GradeScoreValue
  studentId: string
}) {
  const [state, formAction, pending] = useActionState(
    saveGradeScore,
    initialGradebookActionState
  )

  return (
    <>
      <TableCell>
        <form action={formAction} className="contents" id={formId}>
          <input name="gradeItemId" type="hidden" value={item.id} />
          <input name="studentId" type="hidden" value={studentId} />
          <Input
            inputMode="decimal"
            max={item.pointsPossible}
            min="0"
            name="score"
            placeholder="Enter score, e.g. 95"
            step="0.5"
            type="number"
            defaultValue={score?.score ?? ""}
          />
        </form>
      </TableCell>
      <TableCell>
        <Textarea
          form={formId}
          name="feedback"
          placeholder="Optional feedback"
          rows={2}
          defaultValue={score?.feedback ?? ""}
        />
        <ActionMessage state={state} />
      </TableCell>
      <TableCell>
        <Button
          form={formId}
          size="sm"
          type="submit"
          variant="outline"
          disabled={pending}
        >
          {pending ? "Saving..." : "Save score"}
        </Button>
      </TableCell>
    </>
  )
}

function FinalGradeActions({ classSectionId }: { classSectionId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <GradeActionForm
        action={calculateFinalGrades}
        buttonLabel="Calculate final grades"
        classSectionId={classSectionId}
      />
      <GradeActionForm
        action={publishFinalGrades}
        buttonLabel="Publish grades"
        classSectionId={classSectionId}
      />
      <GradeActionForm
        action={finalizeFinalGrades}
        buttonLabel="Finalize grades"
        classSectionId={classSectionId}
      />
    </div>
  )
}

function TranscriptForm({ classSectionId }: { classSectionId: string }) {
  return (
    <GradeActionForm
      action={generateTranscriptsForClassSection}
      buttonLabel="Update transcripts and GPA"
      classSectionId={classSectionId}
    />
  )
}

function GradeActionForm({
  action,
  buttonLabel,
  classSectionId,
}: {
  action: (
    previousState: { ok: boolean; message: string },
    formData: FormData
  ) => Promise<{ ok: boolean; message: string }>
  buttonLabel: string
  classSectionId: string
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialGradebookActionState
  )

  return (
    <form action={formAction} className="space-y-2">
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <Button size="sm" type="submit" variant="outline" disabled={pending}>
        {pending ? "Working..." : buttonLabel}
      </Button>
      <ActionMessage state={state} />
    </form>
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
