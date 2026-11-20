"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { confirmSchoolAbsences, resetCampusAttendanceSchedule, reviseSchoolAttendance, saveSchoolAttendanceSchedule } from "./school-actions"
import type { SchoolScope } from "./school-data"
import { dailyLabels, dailyStatuses, minuteLabel, type DailyStatus, type SchoolSchedule } from "./school-rules"

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const selectClass = "h-10 min-w-0 rounded-md border bg-white px-2 text-sm"

function useSchoolAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState("")
  function run(action: () => Promise<{ error?: string; count?: number }>, success = "Saved.") {
    start(async () => {
      try {
        const result = await action()
        if (result.error) {
          setMessage(result.error)
          return
        }
        setMessage(result.count === undefined ? success : `${result.count} absences confirmed.`)
        router.refresh()
      } catch {
        setMessage("Could not save. Refresh the page to check the latest result and try again.")
      }
    })
  }
  return { pending, message, run }
}

export function SchoolScheduleForm({ scope, schedule, hasOverride }: {
  scope: SchoolScope
  schedule: SchoolSchedule | null
  hasOverride: boolean
}) {
  const [weekdays, setWeekdays] = useState(schedule?.weekdays ?? [1, 2, 3, 4, 5])
  const { pending, message, run } = useSchoolAction()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    run(() => saveSchoolAttendanceSchedule(scope, form))
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-lg border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { name: "opens", label: "Opens at", fallback: 420, value: schedule?.opensMinute },
          { name: "late", label: "Late from", fallback: 480, value: schedule?.lateMinute },
          { name: "closes", label: "Closes at", fallback: 540, value: schedule?.closesMinute },
        ].map(({ name, label, fallback, value }) => (
          <label key={name} className="grid min-w-0 gap-1 text-sm font-medium">{label}
            <Input type="time" name={name} defaultValue={minuteLabel(value ?? fallback)} required className="min-w-0 bg-white" />
          </label>
        ))}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">School days</legend>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <div key={day}>
              <label className="flex min-h-10 items-center gap-2 rounded-md border px-2 text-sm">
                <Switch checked={weekdays.includes(day)} onChange={(event) => {
                  const checked = event.currentTarget.checked
                  setWeekdays((current) => checked ? [...current, day] : current.filter((value) => value !== day))
                }} />
                {dayNames[day]}
              </label>
              {weekdays.includes(day) ? <input type="hidden" name="weekday" value={day} /> : null}
            </div>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-medium">School closure dates
        <Textarea name="closedDates" defaultValue={schedule?.closedDates.join("\n") ?? ""} placeholder="YYYY-MM-DD, one date per line" maxLength={3000} className="bg-white" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>Save schedule</Button>
        {scope.campusId && hasOverride ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => resetCampusAttendanceSchedule(scope))}>Use school schedule</Button>
        ) : null}
      </div>
      {pending || message ? <p className="text-sm" role="status">{pending ? "Saving…" : message}</p> : null}
    </form>
  )
}

export function DailyAttendanceEdit({ scope, schoolDate, studentId, studentName, status, note, canConfirmAbsence }: {
  scope: SchoolScope
  schoolDate: string
  studentId: string
  studentName: string
  status: DailyStatus | "PENDING"
  note: string | null
  canConfirmAbsence: boolean
}) {
  const { pending, message, run } = useSchoolAction()
  const [editing, setEditing] = useState(false)
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    run(() => reviseSchoolAttendance(scope, {
      schoolDate, studentId, expectedStatus: status, expectedNote: note,
      status: String(data.get("status")) as DailyStatus | "PENDING", note: String(data.get("note") ?? ""),
    }))
  }
  if (!editing) return <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
    {status === "PENDING" ? "Record manually" : "Correct attendance"}
  </Button>
  return (
    <form onSubmit={save} className="space-y-2" aria-label={`Edit school attendance for ${studentName}`}>
      <label className="grid gap-1 text-sm">Status
        <select className={selectClass} name="status" defaultValue={status}>
          {(["PENDING", ...dailyStatuses] as const).filter((value) => value !== "ABSENT" || canConfirmAbsence || status === "ABSENT")
            .map((value) => <option key={value} value={value}>{dailyLabels[value]}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Reason
        <Input name="note" required maxLength={500} className="bg-white" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} type="submit">Save attendance</Button>
        <Button size="sm" disabled={pending} type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
      {pending || message ? <p className="text-sm" role="status">{pending ? "Saving…" : message}</p> : null}
    </form>
  )
}

export function DailyAbsenceReview({ scope, schoolDate, studentIds }: { scope: SchoolScope; schoolDate: string; studentIds: string[] }) {
  const [confirm, setConfirm] = useState(false)
  const { pending, message, run } = useSchoolAction()
  if (!studentIds.length && !message) return null
  return (
    <div className="space-y-2">
      {studentIds.length ? confirm ? (
        <>
          <p className="text-sm">Confirm {studentIds.length} unconfirmed students on this page as absent and notify linked parents?</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => run(() => confirmSchoolAbsences(scope, schoolDate, studentIds))}>Confirm and notify</Button>
            <Button disabled={pending} variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        </>
      ) : <Button variant="outline" onClick={() => setConfirm(true)}>Review {studentIds.length} unconfirmed on this page</Button> : null}
      {pending || message ? <p className="text-sm" role="status">{pending ? "Saving…" : message}</p> : null}
    </div>
  )
}
