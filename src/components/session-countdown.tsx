"use client"

import { useEffect, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { Clock } from "lucide-react"

import { Button } from "@/components/ui/button"

const warningThresholdSeconds = 5 * 60

export function SessionCountdown({ compact = false }: { compact?: boolean }) {
  const { data: session, status, update } = useSession()
  const [now, setNow] = useState(() => Date.now())
  const expiresAt = session?.expires ? new Date(session.expires).getTime() : null
  const remainingSeconds = expiresAt
    ? Math.max(0, Math.floor((expiresAt - now) / 1000))
    : null
  const isWarning =
    remainingSeconds !== null && remainingSeconds <= warningThresholdSeconds

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (status !== "authenticated" || remainingSeconds === null) return
    if (remainingSeconds > 0) return

    window.dispatchEvent(
      new CustomEvent("lms-toast", {
        detail: {
          message: "Session expired. Please log in again.",
          tone: "error",
        },
      })
    )
    void signOut({ callbackUrl: "/login?expired=1" })
  }, [remainingSeconds, status])

  async function extendSession() {
    try {
      await update()
      setNow(Date.now())
      window.dispatchEvent(
        new CustomEvent("lms-toast", {
          detail: { message: "Session extended.", tone: "success" },
        })
      )
    } catch {
      window.dispatchEvent(
        new CustomEvent("lms-toast", {
          detail: {
            message: "Could not extend the session. Please log in again.",
            tone: "error",
          },
        })
      )
    }
  }

  if (status !== "authenticated" || remainingSeconds === null) return null

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
        isWarning
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
      title="Session automatically expires after 1 hour."
    >
      <Clock className="h-3.5 w-3.5" />
      <span className={compact ? "sr-only sm:not-sr-only" : ""}>
        {formatRemaining(remainingSeconds)}
      </span>
      <Button
        className="h-6 px-2 text-xs"
        onClick={extendSession}
        size="sm"
        type="button"
        variant={isWarning ? "default" : "outline"}
      >
        Extend
      </Button>
    </div>
  )
}

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
