"use client"

import { useEffect, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import type { AttendanceStatus } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { closeSmartAttendance, openSmartAttendance, publishSmartAttendance, reviseSmartAttendance } from "./smart-actions"
import { attendanceLabels, qrWindowMinutes } from "./smart-shared"

export function SmartSessionControls({ classSessionId, phase, closesInMs, rosterCount }: {
  classSessionId: string
  phase: "setup" | "open" | "review"
  closesInMs?: number
  rosterCount?: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [minutes, setMinutes] = useState(15)
  const [message, setMessage] = useState("")
  const [confirmPublish, setConfirmPublish] = useState(false)

  useEffect(() => {
    if (phase !== "open" || closesInMs === undefined) return
    const timer = window.setTimeout(() => router.refresh(), closesInMs + 500)
    return () => window.clearTimeout(timer)
  }, [closesInMs, phase, router])

  function apply() {
    startTransition(async () => {
      try {
        const result = phase === "setup" ? await openSmartAttendance(classSessionId, minutes) :
          phase === "open" ? await closeSmartAttendance(classSessionId) : await publishSmartAttendance(classSessionId)
        if ("error" in result && result.error) setMessage(result.error)
        else {
          setMessage("")
          router.refresh()
        }
      } catch {
        setMessage("Attendance could not be saved. Refresh to check the latest state and try again.")
      }
    })
  }

  return (
    <div className="space-y-3">
      {phase === "setup" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">
            Check-in window
            <select className="h-10 rounded-md border bg-white px-3" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
              {qrWindowMinutes.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}
            </select>
          </label>
          <Button disabled={pending} onClick={apply}>Open QR check-in</Button>
        </div>
      ) : phase === "open" ? (
        <Button variant="outline" disabled={pending} onClick={apply}>Close check-in and review</Button>
      ) : confirmPublish ? (
        <div className="space-y-2">
          <p className="text-sm">Publish attendance for {rosterCount} students and notify linked parents?</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={apply}>Publish and notify</Button>
            <Button variant="outline" disabled={pending} onClick={() => setConfirmPublish(false)}>Cancel</Button>
          </div>
        </div>
      ) : <Button disabled={!rosterCount} onClick={() => setConfirmPublish(true)}>Finalize attendance</Button>}
      {pending || message ? <p className="text-sm" role="status">{pending ? "Saving…" : message}</p> : null}
    </div>
  )
}

export function SmartAttendanceEdit({ classSessionId, studentId, studentName, status, note, published }: {
  classSessionId: string
  studentId: string
  studentName: string
  status: AttendanceStatus | null
  note: string | null
  published: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(async () => {
      try {
        const result = await reviseSmartAttendance({
          classSessionId, studentId, status: (data.get("status") || null) as Exclude<AttendanceStatus, "PENDING"> | null,
          note: String(data.get("note") ?? ""),
        })
        setMessage("error" in result && result.error ? result.error : "Saved.")
        if ("ok" in result) router.refresh()
      } catch {
        setMessage("Could not save this change. Try again.")
      }
    })
  }

  return (
    <form onSubmit={save} className="space-y-2" aria-label={`Edit attendance for ${studentName}`}>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] sm:items-end">
        <label className="grid min-w-0 gap-1 text-sm">Status
          <select name="status" className="h-10 min-w-0 rounded-md border bg-white px-2" defaultValue={status ?? ""} disabled={pending}>
            {!published ? <option value="">Suggested status</option> : null}
            {Object.entries(attendanceLabels).filter(([value]) => value !== "PENDING").map(([value, label]) =>
              <option value={value} key={value}>{label}</option>
            )}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">Note
          <Input name="note" defaultValue={note ?? ""} maxLength={500} disabled={pending} className="h-10 bg-white" />
        </label>
        <Button variant="outline" disabled={pending} type="submit">{pending ? "Saving…" : "Save change"}</Button>
      </div>
      <p className="text-sm" role="status">{message}</p>
    </form>
  )
}
