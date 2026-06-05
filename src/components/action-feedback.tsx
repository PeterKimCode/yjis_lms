"use client"

import { useEffect, useRef } from "react"

export type ActionFeedbackState = {
  ok: boolean
  message: string
}

export function ActionFeedback({
  closeOnSuccess = false,
  state,
}: {
  closeOnSuccess?: boolean
  state: ActionFeedbackState
}) {
  const ref = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    if (!state.message) return

    window.dispatchEvent(
      new CustomEvent("lms-toast", {
        detail: {
          message: state.message,
          tone: state.ok ? "success" : "error",
        },
      })
    )

    if (!state.ok || !closeOnSuccess) return

    const timer = window.setTimeout(() => {
      const dialog = ref.current?.closest("[data-slot='dialog-content']")
      const closeButton = dialog?.querySelector<HTMLButtonElement>(
        "[data-slot='dialog-close']"
      )
      closeButton?.click()
    }, 650)

    return () => window.clearTimeout(timer)
  }, [closeOnSuccess, state.message, state.ok])

  if (!state.message) return null

  return (
    <p
      ref={ref}
      className={`rounded-md border px-3 py-2 text-sm ${
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
      role="status"
    >
      {state.message}
    </p>
  )
}
