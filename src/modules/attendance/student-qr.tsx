"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getStudentAttendanceQr } from "./smart-actions"

export function StudentQrRefresh({ label = "Refresh sessions" }: { label?: string }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) router.refresh()
    }
    const timer = window.setInterval(refresh, 10_000)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router])
  return <Button variant="outline" onClick={() => router.refresh()}>{label}</Button>
}

export function StudentAttendanceQr({
  sessionId,
  issueAction = getStudentAttendanceQr,
  verifiedMessage = "Check-in verified. Your teacher will publish the final result.",
  prompt = "Show this screen to your teacher. The QR changes every 12 seconds.",
}: {
  sessionId: string
  issueAction?: typeof getStudentAttendanceQr
  verifiedMessage?: string
  prompt?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState("")
  const [checkedIn, setCheckedIn] = useState(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let timer: number | undefined
    let expires: number | undefined
    let requestCount = 0

    async function rotate() {
      if (document.hidden || cancelled) return
      const request = ++requestCount
      const isCurrent = () => !cancelled && !document.hidden && request === requestCount
      const requestedAt = performance.now()
      try {
        const result = await issueAction(sessionId)
        if (!isCurrent()) return
        if ("checkedIn" in result && result.checkedIn) {
          setReady(false)
          setCheckedIn(true)
          setMessage(verifiedMessage)
          return
        }
        if ("error" in result && result.error) {
          setReady(false)
          setMessage(result.error)
          return
        }
        if (!("code" in result) || !result.code) {
          timer = window.setTimeout(rotate, 400)
          return
        }
        const { toCanvas } = await import("qrcode")
        const qr = canvas.current
        if (!isCurrent() || !qr) return
        const remaining = result.validForMs - (performance.now() - requestedAt)
        if (remaining < 200) {
          timer = window.setTimeout(rotate, Math.max(250, result.validForMs + 100))
          return
        }
        await toCanvas(qr, result.code, { width: 288, margin: 4, errorCorrectionLevel: "M" })
        qr.style.removeProperty("width")
        qr.style.removeProperty("height")
        if (!isCurrent()) return
        setMessage("")
        setReady(true)
        window.clearTimeout(expires)
        expires = window.setTimeout(() => setReady(false), remaining)
        timer = window.setTimeout(rotate, result.validForMs + 100)
      } catch {
        if (!isCurrent()) return
        setReady(false)
        setMessage("Could not refresh your QR. Retrying…")
        timer = window.setTimeout(rotate, 3_000)
      }
    }

    function onVisibilityChange() {
      requestCount += 1
      window.clearTimeout(timer)
      window.clearTimeout(expires)
      setReady(false)
      if (!document.hidden) void rotate()
    }

    void rotate()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(expires)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [active, issueAction, sessionId, verifiedMessage])

  return (
    <div className="space-y-3">
      {!active ? <Button onClick={() => setActive(true)}>Show my QR</Button> : null}
      {active && !checkedIn ? (
        <div className="mx-auto w-full max-w-72 rounded-lg border bg-white p-2" hidden={!ready}>
          <canvas ref={canvas} role="img" aria-label="Rotating attendance QR code" className="mx-auto h-auto w-full" />
        </div>
      ) : null}
      <p className="text-sm" role="status">{message}</p>
      {active && !checkedIn && !ready && !message ? <p className="text-sm">Loading your QR…</p> : null}
      {ready ? <p className="text-center text-sm">{prompt}</p> : null}
      {active && !checkedIn ? (
        <Button variant="outline" onClick={() => { setActive(false); setReady(false); setMessage("") }}>Hide QR</Button>
      ) : null}
    </div>
  )
}
