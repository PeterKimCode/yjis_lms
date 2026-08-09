"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

type ToastItem = {
  id: number
  message: string
  tone: "error" | "success"
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function handleToast(event: Event) {
      const detail = (event as CustomEvent).detail as {
        message?: unknown
        tone?: unknown
      }
      const message =
        typeof detail?.message === "string" ? detail.message.trim() : ""
      if (!message) return

      const id = Date.now() + Math.random()
      setToasts((items) => [
        ...items.slice(-2),
        {
          id,
          message,
          tone: detail.tone === "error" ? "error" : "success",
        },
      ])
      window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id))
      }, 3200)
    }

    window.addEventListener("lms-toast", handleToast)
    return () => window.removeEventListener("lms-toast", handleToast)
  }, [])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[70] grid w-[min(360px,calc(100vw-2rem))] gap-2">
      {toasts.map((toast) => (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur animate-in fade-in-50 slide-in-from-bottom-2 ${
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
              : "border-red-200 bg-red-50/95 text-red-800"
          }`}
          key={toast.id}
          role="status"
        >
          {toast.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p className="font-semibold">
              {toast.tone === "success" ? "Saved" : "Action needed"}
            </p>
            <p className="mt-0.5">{toast.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
