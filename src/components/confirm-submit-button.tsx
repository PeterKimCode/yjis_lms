"use client"

import type { ReactNode } from "react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage = "Are you sure? This action cannot be undone.",
  disabled,
  form,
  size = "sm",
  variant = "destructive",
}: {
  children: ReactNode
  className?: string
  confirmMessage?: string
  disabled?: boolean
  form?: string
  size?: "default" | "sm" | "xs"
  variant?: "destructive" | "outline" | "secondary"
}) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Button
        className={className}
        disabled={disabled}
        form={form}
        ref={buttonRef}
        size={size}
        type="submit"
        variant={variant}
        onClick={(event) => {
          if (confirmed) {
            setConfirmed(false)
            return
          }

          event.preventDefault()
          setOpen(true)
        }}
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-slate-200 bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b bg-slate-50 px-5 py-4">
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>
              Please review this action before continuing.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 text-sm leading-relaxed text-slate-700">
            {confirmMessage}
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={() => {
                setConfirmed(true)
                setOpen(false)
                window.requestAnimationFrame(() => buttonRef.current?.click())
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
