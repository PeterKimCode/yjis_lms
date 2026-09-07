"use client"

import { useState } from "react"
import { SimpleTable, TableRow, TableCell } from "@/modules/dashboards/components"

export function LessonCompletionList({ students }: { students: { studentId: string; name: string; status: string; progressRate: number; lastViewed: string }[] }) {
  const [filter, setFilter] = useState("All")
  return <div className="space-y-3">
    <div role="tablist" className="flex flex-wrap gap-2">{["All", "Completed", "Incomplete"].map((value) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`rounded border px-3 py-2 ${filter === value ? "bg-primary text-primary-foreground" : ""}`}>{value} ({students.filter((student) => value === "All" || (value === "Completed" ? student.status === "Completed" : student.status !== "Completed")).length})</button>)}</div>
    <SimpleTable headers={["Student", "Status", "Progress", "Last activity"]} empty="No students" rows={students.filter((student) => filter === "All" || (filter === "Completed" ? student.status === "Completed" : student.status !== "Completed")).map((student) => <TableRow key={student.studentId}><TableCell>{student.name}</TableCell><TableCell>{student.status}</TableCell><TableCell>{student.progressRate.toFixed(0)}%</TableCell><TableCell>{student.lastViewed}</TableCell></TableRow>)} />
  </div>
}
