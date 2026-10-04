"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { dateTimeLocalInTimeZone } from "@/lib/timezone"
import { assessmentTypes } from "./assessment-types"
import { saveQuiz } from "./actions"
import {
  validateEditorQuestions,
  type EditorQuestion
} from "./editor-validation"
import type { QuizPanelValue } from "./quiz-panel"
import { initialQuizActionState } from "./action-state"

function fromQuiz(quiz?: QuizPanelValue): EditorQuestion[] {
  return (
    quiz?.questions.map((question) => {
      const answer = question.answerKey as {
        correctBoolean?: boolean
        acceptedAnswers?: string[]
      } | null
      return {
        key: question.id,
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        points: Number(question.points),
        explanation: question.explanation ?? "",
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
          isCorrect: option.isCorrect
        })),
        correctBoolean: answer?.correctBoolean,
        acceptedAnswers: answer?.acceptedAnswers?.join("\n") ?? ""
      }
    }) ?? []
  )
}
export function QuizEditor({
  classSectionId,
  quiz,
  timeZone = "Asia/Seoul",
  uploadFailed = false
}: {
  classSectionId: string
  quiz?: QuizPanelValue
  timeZone?: string
  uploadFailed?: boolean
}) {
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null),
    dirty = useRef(false),
    pendingRef = useRef(false)
  const [questions, setQuestions] = useState(() => fromQuiz(quiz)),
    [expanded, setExpanded] = useState<string | null>(null)
  const [pending, setPending] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState("")
  const locked = Boolean(quiz?.attempts.length),
    total = questions.reduce(
      (sum, question) =>
        sum + (Number.isFinite(question.points) ? question.points : 0),
      0
    )
  const back = `/instructor/classes/${classSectionId}?tab=assessments&view=quizzes`
  useEffect(() => {
    let restoringHistory = false
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest("a[href]")
      if (
        dirty.current &&
        link &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.defaultPrevented
      ) {
        if (window.confirm("You have unsaved changes. Leave anyway?")) {
          dirty.current = false
        } else {
          event.preventDefault()
          event.stopPropagation()
        }
      }
    }
    const pop = (event: PopStateEvent) => {
      if (restoringHistory) {
        restoringHistory = false
        return
      }
      if (
        dirty.current &&
        !window.confirm("You have unsaved changes. Leave anyway?")
      ) {
        event.stopImmediatePropagation()
        restoringHistory = true
        window.history.forward()
      } else dirty.current = false
    }
    window.addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", pop, true)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", pop, true)
    }
  }, [])
  function update(key: string, changes: Partial<EditorQuestion>) {
    dirty.current = true
    setQuestions((items) =>
      items.map((item) => (item.key === key ? { ...item, ...changes } : item))
    )
  }
  function add(type: "MULTIPLE_CHOICE" | "ESSAY") {
    const key = crypto.randomUUID()
    dirty.current = true
    setQuestions((items) => [
      ...items,
      {
        key,
        type,
        prompt: "",
        points: 1,
        explanation: "",
        acceptedAnswers: "",
        options:
          type === "MULTIPLE_CHOICE"
            ? Array.from({ length: 4 }, () => ({ text: "", isCorrect: false }))
            : []
      }
    ])
    setExpanded(key)
  }
  function focusError(fields: Record<string, string>) {
    const key = Object.keys(fields)[0],
      question = questions[Number(key)]
    if (question) setExpanded(question.key)
    requestAnimationFrame(() => {
      const element = question
        ? form.current?.querySelector<HTMLElement>(
            `[data-question-key="${question.key}"] textarea`
          )
        : (form.current?.elements.namedItem(key) as HTMLElement | null)
      element?.focus()
      element?.scrollIntoView({ block: "center" })
    })
  }
  async function save(publish: boolean) {
    if (pendingRef.current || !form.current) return
    const data = new FormData(form.current),
      fields: Record<string, string> = {}
    if (!String(data.get("title") ?? "").trim()) fields.title = "Enter a title."
    const checked = validateEditorQuestions(questions, publish)
    if (!checked.ok) Object.assign(fields, checked.errors)
    if (Object.keys(fields).length) {
      setErrors(fields)
      focusError(fields)
      return
    }
    const invalid = form.current.querySelector<HTMLInputElement>(":invalid")
    if (invalid) {
      requestAnimationFrame(() => {
        invalid.focus()
        invalid.reportValidity()
      })
      return
    }
    data.set("editorQuestions", JSON.stringify(questions))
    data.set("isPublished", publish ? "on" : "")
    pendingRef.current = true
    setPending(true)
    setErrors({})
    setMessage("")
    try {
      const result = await saveQuiz(initialQuizActionState, data)
      if (result.saved && result.quizId) {
        dirty.current = false
        router.push(
          result.ok ? back : `/instructor/classes/${classSectionId}/quizzes/${result.quizId}?uploadFailed=1`
        )
        router.refresh()
      } else {
        setMessage(result.message)
        setErrors(result.fieldErrors ?? {})
        if (result.fieldErrors) focusError(result.fieldErrors)
      }
    } catch {
      setMessage(
        "Could not save. Your changes are still here. Please try again."
      )
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  function field(name: string, label: string, children: ReactNode) {
    return (
      <label className="grid min-w-0 gap-1 text-sm [&_input]:bg-background [&_textarea]:bg-background [&_select]:bg-background">
        <span className="font-medium">{label}</span>
        {children}
        {errors[name] ? (
          <span role="alert" className="text-red-700">
            {errors[name]}
          </span>
        ) : null}
      </label>
    )
  }
  return (
    <form
      ref={form}
      className="mx-auto w-full min-w-0 max-w-4xl space-y-5 pb-44 md:pb-28"
      onChange={() => {
        dirty.current = true
      }}
      onSubmit={(event) => {
        event.preventDefault()
        void save(quiz?.isPublished ?? false)
      }}
    >
      <input name="id" type="hidden" value={quiz?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <Button asChild variant="secondary" className="border border-slate-300 bg-slate-800 text-white hover:bg-slate-700"><Link href={back}>← Back to Exams / Quiz</Link></Button>
      {uploadFailed ? (
        <p
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Assessment saved. PDF upload failed. Choose the PDF again under PDF
          attachment, then save to retry.
        </p>
      ) : null}
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <div className="grid gap-4 rounded-xl border border-slate-300 bg-card p-4 md:grid-cols-2">
          {field(
            "assessmentType",
            "Assessment type",
            <select
              name="assessmentType"
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue={quiz?.assessmentType ?? "QUIZ"}
              disabled={locked}
            >
              {assessmentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          )}
          {locked ? (
            <input
              type="hidden"
              name="assessmentType"
              value={quiz?.assessmentType ?? "QUIZ"}
            />
          ) : null}
          {field(
            "location",
            "Location (optional)",
            <Input name="location" defaultValue={quiz?.location ?? ""} />
          )}
          <p className="text-xs text-muted-foreground md:col-span-2">
            All start and end times use {timeZone}, for both instructors and
            students.
          </p>
        </div>
        <div className="rounded-xl border border-slate-300 bg-card p-4">
          {field(
            "pdfAttachmentFile",
            "PDF attachment (optional)",
            <>
              <Input
                type="file"
                name="pdfAttachmentFile"
                accept=".pdf,application/pdf"
              />
              <span className="text-xs text-muted-foreground">
                PDF only. Max 20MB.
              </span>
            </>
          )}
        </div>
        <section className="space-y-4 rounded-xl border border-slate-300 bg-card p-4">
          {field(
            "title",
            "Title",
            <Input
              name="title"
              aria-invalid={Boolean(errors.title)}
              defaultValue={quiz?.title ?? ""}
              placeholder="Quiz title"
            />
          )}
          {field(
            "description",
            "Description (optional)",
            <Textarea
              name="description"
              rows={2}
              defaultValue={quiz?.description ?? ""}
            />
          )}
        </section>
        <section className="space-y-3" aria-label="Questions">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Questions · {questions.length}
            </h2>
            <span className="text-sm">
              Total: {Number(total.toFixed(2))} points
            </span>
          </div>
          {!questions.length ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add your first question, or save an empty draft.
            </p>
          ) : null}
          {errors.questions ? (
            <p role="alert" className="text-sm text-red-700">
              {errors.questions}
            </p>
          ) : null}
          {questions.map((question, index) => (
            <div
              key={question.key}
              data-question-key={question.key}
              className="min-w-0 rounded-xl border bg-background"
            >
              <button
                type="button"
                aria-expanded={expanded === question.key}
                onClick={() =>
                  setExpanded(expanded === question.key ? null : question.key)
                }
                className="flex min-h-12 w-full min-w-0 items-center gap-3 p-4 text-left text-sm"
              >
                <span>{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate">
                  {question.prompt || "New question"}
                </span>
                <span className="shrink-0">{question.points} pts</span>
                <span>{expanded === question.key ? "−" : "+"}</span>
              </button>
              {errors[String(index)] ? (
                <p role="alert" className="px-4 pb-2 text-sm text-red-700">
                  {errors[String(index)]}
                </p>
              ) : null}
              <div
                hidden={expanded !== question.key}
                className="space-y-3 border-t p-4"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {field(
                    `type-${index}`,
                    "Question type",
                    <select
                      className="h-9 min-w-0 rounded border bg-background px-2"
                      disabled={locked}
                      value={question.type}
                      onChange={(event) =>
                        update(question.key, {
                          type: event.target.value as EditorQuestion["type"],
                          ...(event.target.value === "MULTIPLE_CHOICE" &&
                          !question.options.length
                            ? {
                                options: Array.from({ length: 4 }, () => ({
                                  text: "",
                                  isCorrect: false
                                }))
                              }
                            : {})
                        })
                      }
                    >
                      {[
                        "MULTIPLE_CHOICE",
                        "ESSAY",
                        "TRUE_FALSE",
                        "SHORT_ANSWER"
                      ]
                        .filter(
                          (type) =>
                            type === question.type ||
                            type === "MULTIPLE_CHOICE" ||
                            type === "ESSAY"
                        )
                        .map((type) => (
                          <option key={type} value={type}>
                            {
                              {
                                MULTIPLE_CHOICE: "Multiple choice",
                                ESSAY: "Open ended",
                                TRUE_FALSE: "True / false",
                                SHORT_ANSWER: "Short answer"
                              }[type]
                            }
                          </option>
                        ))}
                    </select>
                  )}
                  {field(
                    `points-${index}`,
                    "Points",
                    <Input
                      aria-label={`Question ${index + 1} points`}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={locked}
                      value={question.points}
                      onChange={(event) =>
                        update(question.key, {
                          points: Number(event.target.value)
                        })
                      }
                    />
                  )}
                </div>
                {field(
                  `prompt-${index}`,
                  "Question",
                  <Textarea
                    aria-label={`Question ${index + 1}`}
                    value={question.prompt}
                    onChange={(event) =>
                      update(question.key, { prompt: event.target.value })
                    }
                  />
                )}
                {question.type === "MULTIPLE_CHOICE" ? (
                  <fieldset className="space-y-2" disabled={locked}>
                    <legend className="mb-2 text-sm font-medium">
                      Answers · select the correct answer
                    </legend>
                    {question.options.map((option, position) => (
                      <div
                        key={option.id ?? position}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <input
                          type="radio"
                          aria-label={`Question ${index + 1} correct answer ${position + 1}`}
                          name={`correct-${question.key}`}
                          checked={option.isCorrect}
                          onChange={() =>
                            update(question.key, {
                              options: question.options.map((item, i) => ({
                                ...item,
                                isCorrect: i === position
                              }))
                            })
                          }
                        />
                        <Input
                          aria-label={`Question ${index + 1} answer ${position + 1}`}
                          value={option.text}
                          placeholder={`Answer ${position + 1}`}
                          onChange={(event) =>
                            update(question.key, {
                              options: question.options.map((item, i) =>
                                i === position
                                  ? { ...item, text: event.target.value }
                                  : item
                              )
                            })
                          }
                        />
                      </div>
                    ))}
                  </fieldset>
                ) : null}
                {question.type === "TRUE_FALSE"
                  ? field(
                      `answer-${index}`,
                      "Correct answer",
                      <select
                        disabled={locked}
                        value={String(question.correctBoolean)}
                        onChange={(event) =>
                          update(question.key, {
                            correctBoolean: event.target.value === "true"
                          })
                        }
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    )
                  : null}
                {question.type === "SHORT_ANSWER"
                  ? field(
                      `answer-${index}`,
                      "Accepted answers (one per line)",
                      <Textarea
                        disabled={locked}
                        value={question.acceptedAnswers}
                        onChange={(event) =>
                          update(question.key, {
                            acceptedAnswers: event.target.value
                          })
                        }
                      />
                    )
                  : null}
                <details>
                  <summary className="cursor-pointer text-sm">
                    Explanation (optional)
                  </summary>
                  <Textarea
                    className="mt-2"
                    aria-label={`Question ${index + 1} explanation`}
                    value={question.explanation}
                    onChange={(event) =>
                      update(question.key, { explanation: event.target.value })
                    }
                  />
                </details>
                <div className="flex justify-between">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setExpanded(null)}
                  >
                    Done
                  </Button>
                  {!locked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        dirty.current = true
                        setQuestions((items) =>
                          items.filter((item) => item.key !== question.key)
                        )
                        setExpanded(null)
                      }}
                    >
                      Remove question
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!locked ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => add("MULTIPLE_CHOICE")}
              >
                Add multiple choice
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => add("ESSAY")}
              >
                Add open ended
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const key = crypto.randomUUID()
                  dirty.current = true
                  setQuestions((items) => [
                    ...items,
                    {
                      key,
                      type: "ESSAY",
                      prompt:
                        "Read the attached exam paper and write your answers below.",
                      points: 100,
                      explanation: "",
                      acceptedAnswers: "",
                      options: []
                    }
                  ])
                  setExpanded(key)
                }}
              >
                Add PDF answer sheet
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Students have started this quiz. Answer types, answers and points
              are locked to preserve their results.
            </p>
          )}
        </section>
        <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30" aria-labelledby="assessment-settings-title">
          <h2 id="assessment-settings-title" className="font-semibold text-blue-950 dark:text-blue-100">Assessment settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {field(
              "opensAt",
              "Start date / time (optional)",
              <Input
                type="datetime-local"
                name="opensAt"
                defaultValue={dateTimeLocalInTimeZone(quiz?.opensAt, timeZone)}
              />
            )}
            {field(
              "closesAt",
              "End date / time (optional)",
              <Input
                type="datetime-local"
                name="closesAt"
                defaultValue={dateTimeLocalInTimeZone(quiz?.closesAt, timeZone)}
              />
            )}
            {field(
              "timeLimitMinutes",
              "Time limit (minutes, optional)",
              <Input
                type="number"
                name="timeLimitMinutes"
                min="1"
                defaultValue={quiz?.timeLimitMinutes ?? ""}
              />
            )}
            {field(
              "maxAttempts",
              "Maximum attempts",
              <Input
                type="number"
                name="maxAttempts"
                min="1"
                defaultValue={quiz?.maxAttempts ?? 1}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="showResultsToStudents"
                defaultChecked={quiz?.showResultsToStudents ?? true}
              />
              Show results after submission
            </label>
            {field(
              "pointsPossible",
              "Manual total (optional)",
              <Input
                type="number"
                name="pointsPossible"
                min="0"
                step="0.01"
                defaultValue={quiz?.pointsPossible ?? ""}
              />
            )}
          </div>
        </section>
      </fieldset>
      {message ? (
        <p
          role="alert"
          className="rounded border border-red-300 p-3 text-sm text-red-700"
        >
          {message}
        </p>
      ) : null}
      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-4 left-4 right-4 z-10 mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-300 bg-card p-3 shadow-lg md:left-auto md:right-6">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            void save(false)
          }}
        >
          {pending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="button"
          disabled={pending || !questions.length}
          onClick={() => {
            void save(true)
          }}
        >
          {quiz?.isPublished ? "Save published assessment" : "Publish"}
        </Button>
      </div>
    </form>
  )
}
