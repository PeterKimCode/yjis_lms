"use client"

import { useState, type ReactNode } from "react"
import { CircleHelp } from "lucide-react"
import { Tooltip } from "radix-ui"

export function HelpTooltip({ children, label = "Help" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return <Tooltip.Provider delayDuration={200}>
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <span role="button" tabIndex={0} aria-label={label}
          className="inline-flex size-7 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true) }}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setOpen(value => !value) } }}>
          <CircleHelp className="size-4" aria-hidden="true" />
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={6} collisionPadding={16}
          className="z-[100] max-h-[60vh] max-w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-lg">
          {children}
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
}
