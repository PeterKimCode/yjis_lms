import { z } from "zod"

export const editorQuestionSchema = z
  .object({
    key: z.string().min(1),
    id: z.string().optional(),
    type: z.enum(["MULTIPLE_CHOICE", "ESSAY", "TRUE_FALSE", "SHORT_ANSWER"]),
    prompt: z.string().trim().min(1, "Enter the question."),
    points: z.coerce.number().finite().min(0).max(999999.99),
    explanation: z.string().default(""),
    options: z
      .array(
        z.object({
          id: z.string().optional(),
          text: z.string(),
          isCorrect: z.boolean()
        })
      )
      .max(20),
    correctBoolean: z.boolean().optional(),
    acceptedAnswers: z.string().default("")
  })
  .superRefine((question, context) => {
    if (question.type === "MULTIPLE_CHOICE") {
      const filled = question.options.filter((option) => option.text.trim())
      if (filled.length < 2)
        context.addIssue({
          code: "custom",
          path: ["options"],
          message: "Enter at least two answers."
        })
      if (
        filled.filter((option) => option.isCorrect).length !== 1 ||
        question.options.some(
          (option) => option.isCorrect && !option.text.trim()
        )
      )
        context.addIssue({
          code: "custom",
          path: ["options"],
          message: "Select one non-empty correct answer."
        })
    }
    if (question.type === "TRUE_FALSE" && question.correctBoolean === undefined)
      context.addIssue({
        code: "custom",
        path: ["correctBoolean"],
        message: "Select the correct answer."
      })
    if (question.type === "SHORT_ANSWER" && !question.acceptedAnswers.trim())
      context.addIssue({
        code: "custom",
        path: ["acceptedAnswers"],
        message: "Enter an accepted answer."
      })
  })
export const editorQuestionsSchema = z.array(editorQuestionSchema).max(200)
export type EditorQuestion = z.infer<typeof editorQuestionSchema>
export function validateEditorQuestions(value: unknown, publish: boolean) {
  const result = editorQuestionsSchema.safeParse(value)
  if (!result.success)
    return {
      ok: false as const,
      errors: Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.length ? String(issue.path[0]) : "questions",
          issue.message
        ])
      )
    }
  if (publish && !result.data.length)
    return {
      ok: false as const,
      errors: { questions: "Add a question before publishing." }
    }
  const ids = result.data.flatMap((question) =>
    question.id ? [question.id] : []
  )
  if (
    new Set(ids).size !== ids.length ||
    new Set(result.data.map((question) => question.key)).size !==
      result.data.length
  )
    return {
      ok: false as const,
      errors: { questions: "Duplicate questions are not allowed." }
    }
  return { ok: true as const, questions: result.data }
}
