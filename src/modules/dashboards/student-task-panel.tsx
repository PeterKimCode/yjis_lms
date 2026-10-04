import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import type { TaskGroups, StudentTask } from "./student-tasks"

function TaskList({ tasks }: { tasks: StudentTask[] }) {
  return tasks.length ? <ul className="divide-y divide-slate-200">{tasks.map((task) => <li key={task.id} className="flex min-w-0 flex-wrap items-center gap-2 py-3">
    <div className="min-w-0 flex-1 basis-40"><p className="break-words font-medium">{task.title}</p><p className="break-words text-sm text-slate-600">{task.className} · {task.kind}</p><p className="text-sm text-slate-600">{task.dueAt ? `${formatDateTimeInTimeZone(task.dueAt, task.timeZone)} (${task.timeZone})` : "No deadline"} · {task.status === "Available" && task.submitted ? "Retake available" : task.status}</p></div>
    <Button asChild size="sm" variant="outline"><Link href={task.href}>{task.status === "Closed" ? "Check" : "Open"}</Link></Button>
  </li>)}</ul> : <p className="py-3 text-sm text-slate-600">All caught up. Nothing to do here.</p>
}
export function StudentTaskPanel({ groups }: { groups: TaskGroups }) {
  return <section aria-labelledby="student-tasks-title" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 id="student-tasks-title" className="text-lg font-semibold">Your tasks</h2>
    <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-3">{([
      ["today", "Today"], ["soon", "Due soon · next 7 days"], ["overdue", "Not submitted · past deadline"],
    ] as const).map(([key, label]) => <section key={key} className="min-w-0"><h3 className="text-base font-semibold">{label} <span className="text-sm text-slate-500">({groups[key].length})</span></h3><TaskList tasks={groups[key]} />{key === "today" && groups.undated.length ? <div className="mt-3 border-t pt-3"><h4 className="font-medium">No deadline</h4><TaskList tasks={groups.undated} /></div> : null}</section>)}</div>
  </section>
}
