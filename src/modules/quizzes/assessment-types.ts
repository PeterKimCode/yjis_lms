export const assessmentTypes = [
  { value: "QUIZ", label: "Quiz" },
  { value: "MONTHLY", label: "Monthly exam" },
  { value: "MIDTERM", label: "Midterm" },
  { value: "FINAL", label: "Final exam" },
  { value: "OTHER", label: "Other exam" }
] as const
export function assessmentTypeLabel(value: string) {
  return (
    assessmentTypes.find((type) => type.value === value)?.label ?? "Other exam"
  )
}
