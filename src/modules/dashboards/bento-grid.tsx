"use client"

import { useId, useState, type ReactNode } from "react"
import GridLayout, { useContainerWidth, verticalCompactor, type Layout, type LayoutItem } from "react-grid-layout"
import { ArrowDown, ArrowUp, Check, Columns2, GripVertical, Maximize2, Minimize2, MoreHorizontal, Pencil, RotateCcw, Rows2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export type BentoWidget = {
  id: string
  title: string
  content: ReactNode
  w?: number
  h?: number
  minW?: number
  minH?: number
  kind?: "metric" | "content"
  accent?: "blue" | "mint" | "rose" | "neutral"
}
type SavedLayouts = Record<string, Layout>
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function dimensions(widget: BentoWidget, cols: number) {
  const minW = cols === 2 ? 2 : Math.min(cols, Math.max(3, Math.ceil((widget.minW ?? 3) * cols / 12)))
  const minH = widget.minH ?? (widget.kind === "metric" ? 4 : 6)
  return { minW, minH, maxW: cols, maxH: 24 }
}

function pack(items: Layout, cols: number): Layout {
  let x = 0, y = 0, rowHeight = 0
  return items.map((item) => {
    if (x + item.w > cols) { x = 0; y += rowHeight; rowHeight = 0 }
    const next = { ...item, x, y }
    x += item.w
    rowHeight = Math.max(rowHeight, item.h)
    return next
  })
}

function normalize(widgets: BentoWidget[], saved: unknown, cols: number): Layout {
  const defaults = pack(widgets.map((widget) => {
    const bounds = dimensions(widget, cols)
    return { i: widget.id, x: 0, y: 0, w: clamp(Math.ceil((widget.w ?? 4) * cols / 12), bounds.minW, cols), h: clamp(widget.h ?? 4, bounds.minH, 24), ...bounds }
  }), cols)
  if (!Array.isArray(saved)) return defaults
  const byId = new Map(saved.filter((item) => item && typeof item.i === "string").map((item) => [item.i, item]))
  // Stored preferences never control widget content, permissions, or size bounds.
  const result = defaults.map((fallback) => {
    const item = byId.get(fallback.i)
    if (!item || !["x", "y", "w", "h"].every((key) => Number.isSafeInteger(item[key]))) return fallback
    const w = clamp(item.w, fallback.minW!, cols)
    return { ...fallback, x: clamp(item.x, 0, cols - w), y: clamp(item.y, 0, 1000), w, h: clamp(item.h, fallback.minH!, 24) }
  })
  return verticalCompactor.compact(result, cols)
}

type BentoGridProps = {
  widgets: BentoWidget[]
  storageKey: string
  title?: string
}

export function BentoGrid(props: BentoGridProps) {
  return <BentoGridContent key={props.storageKey} {...props} />
}

function BentoGridContent({ widgets, storageKey, title = "Overview" }: BentoGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true })
  const cols = width >= 840 ? 12 : width >= 560 ? 6 : 2
  const headingId = useId()
  const key = `lms:bento:v1:${storageKey}`
  const [saved, setSaved] = useState<SavedLayouts>(() => {
    if (typeof window === "undefined") return {}
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}")
      if (value && typeof value === "object" && !Array.isArray(value)) return value as SavedLayouts
    } catch { /* Unavailable or outdated preferences use the default layout. */ }
    return {}
  })
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState("")
  // Server and initial client markup share the static fallback until measured.
  const ready = mounted
  const layout = normalize(widgets, saved[cols], cols)
  const orderedLayout = [...layout].sort((a, b) => a.y - b.y || a.x - b.x)
  const widgetById = new Map(widgets.map((widget) => [widget.id, widget]))

  function persist(nextLayout: Layout) {
    const next = { ...saved, [cols]: normalize(widgets, nextLayout, cols) }
    setSaved(next)
    try { localStorage.setItem(key, JSON.stringify(next)); setMessage("Layout saved") }
    catch { setMessage("Layout changed. Browser storage is unavailable.") }
  }
  function move(id: string, direction: number) {
    const ordered = [...orderedLayout]
    const index = ordered.findIndex((item) => item.i === id)
    const destination = index + direction
    if (destination < 0 || destination >= ordered.length) return
    ;[ordered[index], ordered[destination]] = [ordered[destination], ordered[index]]
    persist(pack(ordered, cols))
  }
  function resize(id: string, axis: "w" | "h", delta: number) {
    const changed = layout.map((item) => item.i !== id ? item : {
      ...item, [axis]: clamp(item[axis] + delta, axis === "w" ? item.minW! : item.minH!, axis === "w" ? cols : 24),
    })
    persist(pack([...changed].sort((a, b) => a.y - b.y || a.x - b.x), cols))
  }
  function reset() {
    setSaved({})
    try { localStorage.removeItem(key); setMessage("Default layout restored") }
    catch { setMessage("Default restored for this visit. Browser storage is unavailable.") }
  }
  function widgetBody(widget: BentoWidget, item?: LayoutItem) {
    return <>
      <div className="bento-widget-header">
        {editing ? <button type="button" className="bento-drag-handle" aria-label={`Move ${widget.title}`} title="Drag to move; arrow keys to reorder"
          onKeyDown={(event) => {
            if (["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) {
              event.preventDefault(); move(widget.id, ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1)
            }
          }}><GripVertical className="size-4" /></button> : <span className="bento-marker" aria-hidden="true" />}
        <h3 className="min-w-0 flex-1 break-words text-sm font-medium">{widget.title}</h3>
        {editing && item ? <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Arrange ${widget.title}`} title="Widget options"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={orderedLayout[0]?.i === widget.id} onSelect={() => move(widget.id, -1)}><ArrowUp />Move earlier</DropdownMenuItem>
            <DropdownMenuItem disabled={orderedLayout.at(-1)?.i === widget.id} onSelect={() => move(widget.id, 1)}><ArrowDown />Move later</DropdownMenuItem>
            <DropdownMenuItem disabled={item.w >= cols} onSelect={() => resize(widget.id, "w", 1)}><Columns2 />Wider</DropdownMenuItem>
            <DropdownMenuItem disabled={item.w <= item.minW!} onSelect={() => resize(widget.id, "w", -1)}><Minimize2 />Narrower</DropdownMenuItem>
            <DropdownMenuItem disabled={item.h >= 24} onSelect={() => resize(widget.id, "h", 1)}><Maximize2 />Taller</DropdownMenuItem>
            <DropdownMenuItem disabled={item.h <= item.minH!} onSelect={() => resize(widget.id, "h", -1)}><Rows2 />Shorter</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : null}
      </div>
      <div className="bento-widget-body">{widget.content}</div>
    </>
  }
  return <section aria-labelledby={headingId} className="bento-section">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
      <h2 id={headingId} className="text-base font-semibold">{title}</h2>
      <div className="flex items-center gap-2">
        <span role="status" className="max-w-48 text-xs text-muted-foreground">{message}</span>
        {editing ? <Button variant="ghost" size="icon" onClick={reset} aria-label="Restore default layout" title="Restore default layout"><RotateCcw /></Button> : null}
        <Button disabled={!ready} variant={editing ? "default" : "outline"} onClick={() => setEditing(!editing)} aria-pressed={editing}>
          {editing ? <Check /> : <Pencil />}{editing ? "Done" : "Customize"}
        </Button>
      </div>
    </div>
    <div ref={containerRef} className={`bento-container ${editing ? "is-editing" : ""}`}>
      {ready ? <GridLayout
        width={width} layout={layout} gridConfig={{ cols, rowHeight: 32, margin: [18, 18], containerPadding: [0, 0] }}
        dragConfig={{ enabled: editing, handle: ".bento-drag-handle", threshold: 6 }}
        resizeConfig={{ enabled: editing, handles: ["se"] }}
        onDragStop={(next) => persist(next)} onResizeStop={(next) => persist(next)}
      >
        {orderedLayout.map((item) => {
          const widget = widgetById.get(item.i)!
          return <div key={widget.id} className="bento-widget" data-kind={widget.kind ?? "content"} data-accent={widget.accent ?? "neutral"}>
            {widgetBody(widget, item)}
          </div>
        })}
      </GridLayout> : <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {widgets.map((widget) => <div key={widget.id} className="bento-widget min-h-48" data-kind={widget.kind ?? "content"} data-accent={widget.accent ?? "neutral"}>{widgetBody(widget)}</div>)}
      </div>}
    </div>
  </section>
}
