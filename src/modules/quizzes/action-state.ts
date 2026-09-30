export type QuizActionState = {
  ok: boolean
  message: string
  quizId?: string
  saved?: boolean
  fieldErrors?: Record<string, string>
}

export const initialQuizActionState: QuizActionState = {
  ok: false,
  message: "",
}
