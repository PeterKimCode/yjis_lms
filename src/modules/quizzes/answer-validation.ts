export function validateAssessmentAnswers(
  questions: { id: string; type: string; options: { id: string }[] }[],
  form: FormData
) {
  const errors: Record<string, string> = {}
  for (const question of questions) {
    const key = `answer_${question.id}`,
      value = String(form.get(key) ?? "").trim()
    if (!value) errors[key] = "Enter an answer."
    else if (
      question.type === "MULTIPLE_CHOICE" &&
      !question.options.some((option) => option.id === value)
    )
      errors[key] = "Select an answer from this question."
    else if (
      question.type === "TRUE_FALSE" &&
      !["true", "false"].includes(value)
    )
      errors[key] = "Select True or False."
    else if (value.length > 50000)
      errors[key] = "Keep the answer under 50,000 characters."
  }
  return errors
}
