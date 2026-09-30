"use client"

import { Fragment, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react"
import { EmptyState, SimpleTable, TableCell, TableRow } from "@/modules/dashboards/components"
import { Button } from "@/components/ui/button"
import { reorderLessons, renameLessonGroup, moveLessonToGroup } from "@/modules/learning/actions"

export function LessonOrderTable({ classSectionId, editable, lessons, headers, rows, empty, mobileCards, groupTitles }: {
  groupTitles?: Record<string, string> | null
  classSectionId: string
  editable: boolean
  lessons: { id: string; sequence: number; week?: number | null }[]
  headers: string[]
  rows: ReactNode[]
  empty: ReactNode
  mobileCards?: ReactNode[]
}) {
  const router = useRouter()
  const [order, setOrder] = useState(lessons.map((lesson) => lesson.id))
  const [active, setActive] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [undo, setUndo] = useState<string[] | null>(null)
  const [collapsed, setCollapsed] = useState<number[]>([])
  const target = useRef<string | null>(null)
  const container = useRef<HTMLDivElement>(null)

  const [editingGroup, setEditingGroup] = useState<number | null>(null)
  const [groupTitle, setGroupTitle] = useState("")
  const groupLabel = (week: number) => groupTitles?.[String(week)] || (week ? `Week ${week}` : "Ungrouped")
  const groups = [...new Set([0, ...lessons.map((lesson) => lesson.week ?? 0), ...Object.keys(groupTitles ?? {}).map(Number)])].sort((a, b) => a - b)
  async function saveChange(action: () => Promise<{ ok: boolean; message: string }>) {
    setSaving(true)
    try {
      const result = await action()
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: result.message, tone: result.ok ? "success" : "error" } }))
      if (result.ok) { setEditingGroup(null); setUndo(null); router.refresh() }
    } catch { window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Could not save. Please try again.", tone: "error" } })) }
    finally { setSaving(false) }
  }
  function groupHeader(week: number) {
    return <div className="flex min-w-0 flex-wrap items-center gap-2">
      {editingGroup === week ? <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void saveChange(() => renameLessonGroup(classSectionId, week, groupTitle)) }}>
        <input aria-label="Group title" autoFocus required maxLength={100} className="min-w-0 rounded border bg-background px-2 py-1 text-foreground" value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
        <Button type="submit" size="sm" disabled={saving}>Save</Button><Button type="button" variant="outline" size="sm" onClick={() => setEditingGroup(null)}>Cancel</Button>
      </form> : <><button type="button" aria-expanded={!collapsed.includes(week)} className="min-h-11 py-2 text-left font-medium" onClick={() => setCollapsed((values) => values.includes(week) ? values.filter((value) => value !== week) : [...values, week])}>{collapsed.includes(week) ? "+" : "−"} {groupLabel(week)}</button>
      {editable ? <Button type="button" size="sm" variant="outline" disabled={saving} aria-label={`Rename ${groupLabel(week)}`} onClick={() => { setEditingGroup(week); setGroupTitle(groupLabel(week)) }}>Rename</Button> : null}</>}
    </div>
  }
  function groupSelect(id: string, week: number) {
    return editable ? <select aria-label={`Move lesson ${lessons.findIndex((lesson) => lesson.id === id) + 1} to group`} disabled={saving} value={week} className="max-w-40 rounded border bg-background p-1 text-xs text-foreground" onChange={(event) => { void saveChange(() => moveLessonToGroup(classSectionId, id, Number(event.target.value))) }}>
      {groups.map((group) => <option key={group} value={group}>{groupLabel(group)}</option>)}
    </select> : null
  }

  async function move(id: string, destination: string) {
    if (saving || id === destination) return
    if (lessons.find((lesson) => lesson.id === id)?.week !== lessons.find((lesson) => lesson.id === destination)?.week) {
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Change the lesson's Week in Edit to move it to another week.", tone: "error" } }))
      return
    }
    const previous = order
    const next = [...order]
    next.splice(next.indexOf(id), 1)
    next.splice(order.indexOf(destination), 0, id)
    setOrder(next)
    setSaving(true)
    try {
      const result = await reorderLessons(classSectionId, next)
      if (!result.ok) setOrder(previous)
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: result.message, tone: result.ok ? "success" : "error" } }))
      if (result.ok) { setUndo(previous); router.refresh() }
    } catch {
      setOrder(previous)
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Could not save lesson order. Please try again.", tone: "error" } }))
    } finally {
      setSaving(false)
    }
  }

  return <div ref={container} aria-busy={saving}>
    {undo ? <button type="button" className="mb-2 rounded border px-3 py-1 text-sm" disabled={saving} onClick={async () => {
      setSaving(true)
      try {
        const result = await reorderLessons(classSectionId, undo)
        if (result.ok) { setOrder(undo); setUndo(null); router.refresh() }
        window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: result.message, tone: result.ok ? "success" : "error" } }))
      } catch { window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Undo failed. Please try again.", tone: "error" } })) }
      finally { setSaving(false) }
    }}>Undo order change</button> : null}
    {mobileCards ? <div className="space-y-3 md:hidden">
      {order.length === 0 ? <EmptyState>{empty}</EmptyState> : null}
      {order.map((id, index) => {
        const sourceIndex = lessons.findIndex((lesson) => lesson.id === id)
        const week = lessons[sourceIndex].week ?? 0
        const previousWeek = index ? lessons.find((lesson) => lesson.id === order[index - 1])?.week ?? 0 : -1
        const canMove = (offset: number) => {
          const destination = lessons.find((lesson) => lesson.id === order[index + offset])
          return destination && (destination.week ?? 0) === week
        }
        return <Fragment key={id}>
          {previousWeek !== week ? groupHeader(week) : null}
          {!collapsed.includes(week) ? <article className="min-w-0 rounded-lg border bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Lesson {index + 1}</span>
              {editable ? <div className="flex gap-1">
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move lesson ${index + 1} up`} disabled={saving || !canMove(-1)} onClick={() => { void move(id, order[index - 1]) }}><ArrowUp /></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move lesson ${index + 1} down`} disabled={saving || !canMove(1)} onClick={() => { void move(id, order[index + 1]) }}><ArrowDown /></Button>
              </div> : null}
            </div>
            {groupSelect(id, week)}
            {mobileCards[sourceIndex]}
          </article> : null}
        </Fragment>
      })}
    </div> : null}
    <div className={mobileCards ? "hidden md:block" : undefined}>
    <SimpleTable headers={headers} empty={empty} rows={order.flatMap((id, index) => {
      const sourceIndex = lessons.findIndex((lesson) => lesson.id === id)
      const week = lessons[sourceIndex].week ?? 0
      const previousWeek = index ? lessons.find((lesson) => lesson.id === order[index - 1])?.week ?? 0 : -1
      const group = previousWeek !== week ? <TableRow key={`week-${id}`}><TableCell colSpan={headers.length}>{groupHeader(week)}</TableCell></TableRow> : null
      if (collapsed.includes(week)) return [group]
      return [group, <TableRow key={id} data-lesson-order-id={id} className={active === id ? "border-t-2 border-t-sky-500 bg-sky-100" : ""}>
        <TableCell>
          <div className="flex items-center gap-2">
            {editable ? <button
              type="button" disabled={saving || order.length < 2}
              className="touch-none cursor-grab rounded p-2 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
              aria-label={`Move lesson ${index + 1}`} title="Drag to reorder. Use arrow keys to move."
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.currentTarget.setPointerCapture(event.pointerId)
                target.current = id
                setActive(id)
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-lesson-order-id]")
                if (row && container.current?.contains(row)) {
                  target.current = row.dataset.lessonOrderId ?? id
                  setActive(target.current)
                  row.scrollIntoView({ block: "nearest" })
                }
              }}
              onPointerUp={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                event.currentTarget.releasePointerCapture(event.pointerId)
                setActive(null)
                void move(id, target.current ?? id)
                target.current = null
              }}
              onPointerCancel={() => { setActive(null); target.current = null }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
                event.preventDefault()
                const destination = order[index + (event.key === "ArrowUp" ? -1 : 1)]
                if (destination) void move(id, destination)
              }}
            ><GripVertical className="size-4" /></button> : null}
            {editable ? index + 1 : lessons[sourceIndex].sequence}
            {groupSelect(id, week)}
          </div>
        </TableCell>
        {rows[sourceIndex]}
      </TableRow>]
    })} />
    </div>
    {saving ? <p role="status" className="mt-2 text-sm text-muted-foreground">Saving lesson order...</p> : null}
  </div>
}
