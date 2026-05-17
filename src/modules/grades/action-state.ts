export type GradebookActionState = {
  ok: boolean
  message: string
}

export const initialGradebookActionState: GradebookActionState = {
  ok: false,
  message: "",
}
