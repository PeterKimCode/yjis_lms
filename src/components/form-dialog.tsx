"use client"

import { useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function FormDialog({
  children,
  description,
  title,
  trigger,
  variant = "default",
  triggerClassName,
  initialOpen = false,
  onClose,
}: {
  triggerClassName?: string
  initialOpen?: boolean
  onClose?: () => void
  children: ReactNode
  description?: string
  title: string
  trigger: ReactNode
  variant?: "default" | "outline" | "secondary"
}) {
  const [open, setOpen] = useState(initialOpen)
  const content = useRef<HTMLDivElement>(null)
  function close() { setOpen(false); onClose?.() }
  function changeOpen(next: boolean) {
    if (!next) {
      for (const form of content.current?.querySelectorAll("form") ?? []) {
        if (!form.dispatchEvent(new CustomEvent("lms-confirm-leave", { cancelable: true, detail: { proceed: close } }))) return
      }
      close()
      return
    }
    setOpen(next)
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant} className={triggerClassName}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent ref={content} {...(!description ? { "aria-describedby": undefined } : {})} className="border-slate-200 bg-white p-0 shadow-2xl sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader className="border-b bg-slate-50/80 px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="min-w-0 px-5 pb-5">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
