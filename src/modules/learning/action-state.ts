export type LessonActionState = {
  ok: boolean
  message: string
}

export const initialLessonActionState: LessonActionState = {
  ok: false,
  message: "",
}
