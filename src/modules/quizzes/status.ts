export function getQuizAttemptStatus(attempt: {
  submittedAt?: Date | string | null
  score?: unknown
  answers?: Array<{ score?: unknown; question?: { type?: string } }>
}) {
  if (!attempt.submittedAt) return "In progress"

  const needsManual = attempt.answers?.some(
    (answer) =>
      ["ESSAY", "SHORT_ANSWER"].includes(answer.question?.type ?? "") &&
      (answer.score === null || answer.score === undefined)
  )

  if (needsManual) return "Needs manual grading"
  if (attempt.score !== null && attempt.score !== undefined) return "Graded"

  return "Submitted"
}

export function shouldShowQuizResults(quiz: {
  showResultsToStudents?: boolean
}) {
  return quiz.showResultsToStudents !== false
}
