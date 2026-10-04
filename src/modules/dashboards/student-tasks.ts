import { assessmentAvailability } from "@/modules/quizzes/availability"

export type StudentTask = {
  id: string; title: string; className: string; href: string
  dueAt: Date | null; opensAt?: Date | null; timeZone: string; submitted: boolean
  status: string; kind: "Assignment" | "Exams / Quiz"
}
export type TaskGroups = Record<"today" | "soon" | "overdue" | "undated", StudentTask[]>
export function groupStudentTasks(tasks: StudentTask[], now = new Date()): TaskGroups {
  const groups: TaskGroups = { today: [], soon: [], overdue: [], undated: [] }
  const day = (date: Date, zone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone }).formatToParts(date)
    const values = new Map(parts.map((part) => [part.type, part.value]))
    return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
  }
  for (const task of tasks) {
    if (task.submitted && task.status !== "Available") continue
    if (!task.dueAt) { if (task.status === "Available") groups.undated.push(task); continue }
    if (task.dueAt < now) { if (!task.submitted) groups.overdue.push(task); continue }
    const today = day(now, task.timeZone)
    const due = day(task.dueAt, task.timeZone)
    if (due === today) groups.today.push(task)
    else {
      // Calendar days, rather than 168 elapsed hours, keep DST school dates correct.
      const distance = (Date.parse(due) - Date.parse(today)) / 86400000
      if (distance > 0 && distance <= 7) groups.soon.push(task)
    }
  }
  for (const list of Object.values(groups)) list.sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  return groups
}

export function quizTaskStatus(quiz: Parameters<typeof assessmentAvailability>[0], attempts: number, questions: number, now: Date) {
  return assessmentAvailability(quiz, attempts, questions, now)
}
