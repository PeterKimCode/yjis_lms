"use client"

import type { ReactNode } from "react"

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
}: {
  triggerClassName?: string
  children: ReactNode
  description?: string
  title: string
  trigger: ReactNode
  variant?: "default" | "outline" | "secondary"
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant} className={triggerClassName}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-slate-200/90 bg-white/95 p-0 shadow-2xl sm:max-w-3xl lg:max-w-5xl">
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
