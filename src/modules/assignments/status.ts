export function getSubmissionStatus({
  dueAt,
  score,
  submittedAt,
}: {
  dueAt?: Date | string | null
  score?: unknown
  submittedAt?: Date | string | null
}) {
  if (score !== null && score !== undefined) {
    return "Graded"
  }

  if (!submittedAt) {
    return dueAt && new Date(dueAt).getTime() < Date.now()
      ? "Missing"
      : "Not submitted"
  }

  if (dueAt && new Date(submittedAt).getTime() > new Date(dueAt).getTime()) {
    return "Late"
  }

  return "Submitted"
}
