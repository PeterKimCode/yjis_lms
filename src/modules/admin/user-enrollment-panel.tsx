"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable, TableCell, TableRow } from "./components"
import { enrollFromUserPage } from "./user-enrollment-actions"
import type { getUserEnrollmentData } from "./user-enrollment-data"

type EnrollmentData = NonNullable<Awaited<ReturnType<typeof getUserEnrollmentData>>>

export function UserEnrollmentPanel({ userId, data }: { userId: string; data: EnrollmentData }) {
  const router = useRouter()
  const [sectionId, setSectionId] = useState(data.sections[0]?.id ?? "")
  const [tab, setTab] = useState("All")
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  const section = data.sections.find((item) => item.id === sectionId)
  const rows = data.mode === "student" ? data.sections.map((item) => ({
    id: item.id, name: item.name, detail: `${item.course} · ${item.teachers}`,
    campus: item.campus, extra: `${item.grade} · ${item.term} · ${item.code}`,
    status: item.enrollments.find((enrollment) => enrollment.studentId === userId)?.status ?? "NOT_ENROLLED",
    active: true, places: `${item.enrolled}/${item.capacity ?? "Unlimited"}`,
    href: `/admin/class-sections/${item.id}`,
  })) : data.students.map((student) => ({
    id: student.id, name: student.name, detail: student.email ?? "-", campus: "", extra: "",
    status: section?.enrollments.find((enrollment) => enrollment.studentId === student.id)?.status ?? "NOT_ENROLLED",
    active: student.isActive, places: "", href: `/admin/users/${student.id}`,
  }))
  function matches(status: string, value: string) {
    return value === "All" || (value === "Enrolled" ? status === "ENROLLED" : value === "Not enrolled" ? status === "NOT_ENROLLED" : status !== "ENROLLED" && status !== "NOT_ENROLLED")
  }
  const visible = rows.filter((row) => matches(row.status, tab) && `${row.name} ${row.detail} ${row.campus} ${row.extra}`.toLowerCase().includes(query.toLowerCase()))
  const eligible = visible.filter((row) => row.status === "NOT_ENROLLED" && row.active).map((row) => row.id)
  const chosen = selected.filter((id) => eligible.includes(id))
  async function enroll() {
    startTransition(async () => {
      try {
        const result = await enrollFromUserPage({ userId, mode: data.mode, sectionId, selectedIds: chosen })
        setMessage(result.message)
        window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: result.message, tone: result.ok ? "success" : "error" } }))
        if (result.ok) { setSelected([]); router.refresh() }
      } catch { setMessage("Could not enroll. Please try again.") }
    })
  }
  return <section className="min-w-0 space-y-4" aria-busy={pending}>
    {data.mode === "instructor" ? <label className="grid gap-2 text-sm"><span>Assigned class</span><select disabled={pending} className="h-10 w-full rounded-md border bg-background px-3" value={sectionId} onChange={(event) => { setSectionId(event.target.value); setSelected([]); setMessage("") }}>
      {!data.sections.length ? <option value="">No assigned classes in this organization</option> : null}
      {data.sections.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.course} · {item.campus} · {item.term} ({item.enrolled}/{item.capacity ?? "Unlimited"})</option>)}
    </select></label> : null}
    {data.mode === "student" || section ? <>
      {section && data.mode === "instructor" ? <Link className="text-sm text-primary underline" href={`/admin/class-sections/${section.id}`}>View class and enrollment statuses</Link> : null}
      <div role="tablist" aria-label="Enrollment status" className="flex flex-wrap gap-2">{["All", "Enrolled", "Not enrolled", "Other status"].map((value) => <button type="button" role="tab" aria-selected={tab === value} key={value} disabled={pending} onClick={() => { setTab(value); setSelected([]) }} className={`rounded-md px-3 py-2 text-sm ${tab === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{value} ({rows.filter((row) => matches(row.status, value)).length})</button>)}</div>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(search); setSelected([]) }}><Input className="min-w-0 flex-1" aria-label="Search classes or students" placeholder={data.mode === "student" ? "Search class, course, teacher or code" : "Search student name or login ID"} value={search} onChange={(event) => setSearch(event.target.value)} /><Button type="submit" variant="outline">Search</Button></form>
      <div className="flex flex-wrap items-center gap-3 text-sm"><span>{chosen.length} selected</span><Button disabled={pending || !chosen.length} onClick={enroll}>{pending ? "Enrolling..." : "Enroll selected"}</Button><span className="text-muted-foreground">{visible.length} shown</span></div>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <div className="flex items-center gap-2 text-sm"><input aria-label="Select all available results" type="checkbox" disabled={pending || !eligible.length} checked={eligible.length > 0 && chosen.length === eligible.length} onChange={(event) => setSelected(event.target.checked ? eligible : [])} />Select available results</div>
      <DataTable minWidth="min-w-[760px]" empty="No matching results." headers={data.mode === "student" ? ["Select", "Class / Course / Teachers", "Campus", "Grade / Term / Code", "Enrolled / Capacity", "Status", "Open"] : ["Select", "Student / Login ID", "Status", "Open"]} rows={visible.map((row) => <TableRow key={row.id}>
        <TableCell><input type="checkbox" aria-label={`Select ${row.name}`} checked={chosen.includes(row.id)} disabled={pending || !eligible.includes(row.id)} onChange={(event) => setSelected((values) => event.target.checked ? [...values, row.id] : values.filter((id) => id !== row.id))} /></TableCell>
        <TableCell><div className="font-medium whitespace-normal">{row.name}</div><div className="text-xs text-muted-foreground whitespace-normal">{row.detail}</div></TableCell>
        {data.mode === "student" ? <><TableCell>{row.campus}</TableCell><TableCell>{row.extra}</TableCell><TableCell>{row.places}</TableCell></> : null}
        <TableCell><span className={`text-xs ${row.status === "ENROLLED" ? "text-emerald-700" : "text-muted-foreground"}`}>{row.status === "NOT_ENROLLED" ? "Not enrolled" : row.status}{!row.active ? " · Inactive" : ""}</span></TableCell>
        <TableCell><Button asChild size="sm" variant="outline"><Link href={row.href}>View</Link></Button></TableCell>
      </TableRow>)} />
    </> : null}
  </section>
}
