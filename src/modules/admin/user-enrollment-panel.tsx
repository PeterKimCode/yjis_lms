"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable, TableCell, TableRow } from "./components"
import { enrollFromUserPage } from "./user-enrollment-actions"
import { loadUserEnrollmentPage } from "./user-enrollment-query"
import type { getUserEnrollmentData } from "./user-enrollment-data"

type EnrollmentData = NonNullable<Awaited<ReturnType<typeof getUserEnrollmentData>>>
type Query = Parameters<typeof loadUserEnrollmentPage>[0]
const tabs = ["All", "Enrolled", "Not enrolled", "Other status"] as const

export function UserEnrollmentPanel({ userId, data: initialData }: { userId: string; data: EnrollmentData }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState(initialData.q)
  const [selected, setSelected] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  const section = data.sections.find((item) => item.id === data.sectionId)
  const rows = data.mode === "student" ? data.sections.map((item) => ({
    id: item.id, name: item.name, detail: `${item.course} · ${item.teachers}`,
    campus: item.campus, extra: `${item.grade} · ${item.term} · ${item.code}`,
    status: item.enrollments.find((enrollment) => enrollment.studentId === userId)?.status ?? "NOT_ENROLLED",
    active: data.subjectActive, places: `${item.enrolled}/${item.capacity ?? "Unlimited"}`,
    href: `/admin/class-sections/${item.id}`,
  })) : data.students.map((student) => ({
    id: student.id, name: student.name, detail: student.email ?? "-", campus: "", extra: "",
    status: section?.enrollments.find((enrollment) => enrollment.studentId === student.id)?.status ?? "NOT_ENROLLED",
    active: student.isActive, places: "", href: `/admin/users/${student.id}`,
  }))
  const eligible = rows.filter((row) => row.status === "NOT_ENROLLED" && row.active).map((row) => row.id)
  const chosen = selected.filter((id) => eligible.includes(id))
  const currentQuery: Query = { userId, page: data.page, q: data.q, tab: data.tab, sectionId: data.sectionId }

  async function reload(overrides: Partial<Query> = {}) {
    const result = await loadUserEnrollmentPage({ ...currentQuery, ...overrides })
    if (!result) throw new Error("Unavailable")
    setData(result)
    setSelected([])
  }
  function navigate(overrides: Partial<Query>) {
    startTransition(async () => {
      setMessage("")
      try { await reload(overrides) }
      catch { setMessage("Unable to load results. Please try again.") }
    })
  }
  function enroll() {
    startTransition(async () => {
      try {
        const result = await enrollFromUserPage({ userId, mode: data.mode, sectionId: data.sectionId, selectedIds: chosen })
        setMessage(result.message)
        window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: result.message, tone: result.ok ? "success" : "error" } }))
        if (result.ok) {
          setSelected([])
          try { await reload() } catch { setMessage("Enrollment saved. Refresh to see the updated list.") }
          router.refresh()
        }
      } catch { setMessage("Could not enroll. Please try again.") }
    })
  }
  function checkbox(row: typeof rows[number]) {
    return <input type="checkbox" aria-label={`Select ${row.name}`} checked={chosen.includes(row.id)} disabled={pending || !eligible.includes(row.id)}
      onChange={(event) => setSelected((values) => event.target.checked ? [...values, row.id] : values.filter((id) => id !== row.id))} />
  }
  function status(row: typeof rows[number]) {
    return <span className={`text-sm ${row.status === "ENROLLED" ? "text-emerald-700" : "text-muted-foreground"}`}>
      {row.status === "NOT_ENROLLED" ? "Not enrolled" : row.status}{!row.active ? " · Inactive" : ""}
    </span>
  }
  return <section className="min-w-0 space-y-4" aria-busy={pending}>
    {data.mode === "instructor" ? <label className="grid gap-2 text-sm"><span>Assigned class</span>
      <select disabled={pending} className="h-10 w-full rounded-md border bg-background px-3" value={data.sectionId}
        onChange={(event) => navigate({ sectionId: event.target.value, page: 1 })}>
        {!data.sectionOptions.length ? <option value="">No assigned classes in this organization</option> : null}
        {data.sectionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label> : null}
    {data.mode === "student" || section ? <>
      {section && data.mode === "instructor" ? <Link className="text-sm text-primary underline" href={`/admin/class-sections/${section.id}`}>
        {section.course} · {section.campus} · {section.term} ({section.enrolled}/{section.capacity ?? "Unlimited"})
      </Link> : null}
      <div role="group" aria-label="Enrollment status" className="flex flex-wrap gap-2">
        {tabs.map((value) => <button type="button" aria-pressed={data.tab === value} key={value} disabled={pending}
          onClick={() => navigate({ tab: value, page: 1 })}
          className={`min-h-11 rounded-md px-3 py-2 text-sm ${data.tab === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {value} ({data.tabCounts[value]})
        </button>)}
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); navigate({ q: search, page: 1 }) }}>
        <Input disabled={pending} maxLength={200} className="min-w-0 flex-1" aria-label="Search classes or students"
          placeholder={data.mode === "student" ? "Search class, course, teacher or code" : "Search student name or login ID"}
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <Button disabled={pending} type="submit" variant="outline">Search</Button>
      </form>
      <div className="flex flex-wrap items-center gap-3 text-sm"><span>{chosen.length} selected</span>
        <Button disabled={pending || !chosen.length} onClick={enroll}>Enroll selected</Button>
        <span className="text-muted-foreground" role="status">{pending ? "Updating..." : `${rows.length} of ${data.total} shown`}</span>
      </div>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" disabled={pending || !eligible.length} checked={eligible.length > 0 && chosen.length === eligible.length}
          onChange={(event) => setSelected(event.target.checked ? eligible : [])} />Select available results on this page
      </label>
      <div className="divide-y border-y md:hidden">
        {!rows.length ? <p className="py-4 text-sm text-muted-foreground">No matching results.</p> : null}
        {rows.map((row) => <article key={row.id} className="flex min-w-0 items-start gap-3 py-4">
          <label className="flex size-11 shrink-0 items-center justify-center">{checkbox(row)}</label>
          <div className="min-w-0 flex-1 space-y-1 break-words">
            <Link className="block font-medium text-primary underline-offset-4 hover:underline" href={row.href}>{row.name}</Link>
            <p className="text-sm text-muted-foreground">{row.detail}</p>
            {data.mode === "student" ? <><p className="text-sm">{row.campus} · {row.extra}</p><p className="text-sm">Enrolled / Capacity: {row.places}</p></> : null}
            {status(row)}
          </div>
        </article>)}
      </div>
      <div className="hidden md:block">
        <DataTable minWidth="min-w-[760px]" empty="No matching results."
          headers={data.mode === "student" ? ["Select", "Class / Course / Teachers", "Campus", "Grade / Term / Code", "Enrolled / Capacity", "Status", "Open"] : ["Select", "Student / Login ID", "Status", "Open"]}
          rows={rows.map((row) => <TableRow key={row.id}>
            <TableCell>{checkbox(row)}</TableCell>
            <TableCell><div className="font-medium whitespace-normal">{row.name}</div><div className="text-sm text-muted-foreground whitespace-normal">{row.detail}</div></TableCell>
            {data.mode === "student" ? <><TableCell>{row.campus}</TableCell><TableCell>{row.extra}</TableCell><TableCell>{row.places}</TableCell></> : null}
            <TableCell>{status(row)}</TableCell>
            <TableCell><Button asChild size="sm" variant="outline"><Link href={row.href}>View</Link></Button></TableCell>
          </TableRow>)} />
      </div>
      <nav aria-label="Enrollment pages" className="flex items-center justify-end gap-3">
        <Button size="icon" variant="outline" aria-label="Previous page" title="Previous page" disabled={pending || data.page <= 1}
          onClick={() => navigate({ page: data.page - 1 })}><ChevronLeft /></Button>
        <span className="text-sm">Page {data.page} of {data.pageCount}</span>
        <Button size="icon" variant="outline" aria-label="Next page" title="Next page" disabled={pending || data.page >= data.pageCount}
          onClick={() => navigate({ page: data.page + 1 })}><ChevronRight /></Button>
      </nav>
    </> : null}
  </section>
}
