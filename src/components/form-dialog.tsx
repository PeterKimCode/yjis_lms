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
}: {
  children: ReactNode
  description?: string
  title: string
  trigger: ReactNode
  variant?: "default" | "outline" | "secondary"
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
