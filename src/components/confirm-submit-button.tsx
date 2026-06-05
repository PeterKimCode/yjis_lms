"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

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
  return (
    <Button
      className={className}
      disabled={disabled}
      form={form}
      size={size}
      type="submit"
      variant={variant}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault()
        }
      }}
    >
      {children}
    </Button>
  )
}
