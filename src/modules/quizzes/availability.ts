type Schedule = { isPublished: boolean; archivedAt?: Date | string | null; opensAt: Date | string | null; closesAt: Date | string | null; maxAttempts: number | null }
export function assessmentAvailability(quiz: Schedule, attempts: number, questionCount: number, now = new Date()) {
  if (!quiz.isPublished || quiz.archivedAt || !questionCount) return "Unavailable"
  if (quiz.opensAt && new Date(quiz.opensAt) > now) return "Not open yet"
  if (quiz.closesAt && new Date(quiz.closesAt) < now) return "Closed"
  if (attempts >= (quiz.maxAttempts ?? 1)) return "Maximum attempts reached"
  return "Available"
}
