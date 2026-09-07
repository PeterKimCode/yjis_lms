"use client"

import { useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { GripVertical } from "lucide-react"
import { SimpleTable, TableCell, TableRow } from "@/modules/dashboards/components"
import { reorderLessons } from "@/modules/learning/actions"

export function LessonOrderTable({ classSectionId, editable, lessons, headers, rows, empty }: {
  classSectionId: string
  editable: boolean
  lessons: { id: string; sequence: number }[]
  headers: string[]
  rows: ReactNode[]
  empty: ReactNode
}) {
  const router = useRouter()
  const [order, setOrder] = useState(lessons.map((lesson) => lesson.id))
  const [active, setActive] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const target = useRef<string | null>(null)
  const container = useRef<HTMLDivElement>(null)

  async function move(id: string, destination: string) {
    if (saving || id === destination) return
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
      if (result.ok) router.refresh()
    } catch {
      setOrder(previous)
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Could not save lesson order. Please try again.", tone: "error" } }))
    } finally {
      setSaving(false)
    }
  }

  return <div ref={container} aria-busy={saving}>
    <SimpleTable headers={headers} empty={empty} rows={order.map((id, index) => {
      const sourceIndex = lessons.findIndex((lesson) => lesson.id === id)
      return <TableRow key={id} data-lesson-order-id={id} className={active === id ? "bg-sky-100" : ""}>
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
          </div>
        </TableCell>
        {rows[sourceIndex]}
      </TableRow>
    })} />
    {saving ? <p role="status" className="mt-2 text-sm text-muted-foreground">Saving lesson order...</p> : null}
  </div>
}
