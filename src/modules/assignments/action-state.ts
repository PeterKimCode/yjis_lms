export type AssignmentActionState = {
  ok: boolean
  message: string
  fieldErrors?: Record<string, string>
}

export const initialAssignmentActionState: AssignmentActionState = {
  ok: false,
  message: "",
}
