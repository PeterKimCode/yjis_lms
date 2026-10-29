"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { HelpTooltip } from "@/components/help-tooltip"
import { setOrganizationLoginVisibility } from "./notices"

export function OrganizationLoginVisibility({ organizationId, visible }: { organizationId: string; visible: boolean }) {
  const [shown, setShown] = useState(visible)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  function change(next: boolean) {
    setShown(next)
    setMessage("")
    startTransition(async () => {
      try {
        const result = await setOrganizationLoginVisibility(organizationId, next)
        setFailed(!result.ok)
        setMessage(result.message)
        if (!result.ok) setShown(!next)
        else router.refresh()
      } catch {
        setShown(!next)
        setFailed(true)
        setMessage("Could not save visibility. Please try again.")
      }
    })
  }
  return <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <Switch checked={shown} disabled={pending} onChange={event => change(event.target.checked)} />
        Show organization on login page
      </label>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>{pending ? "Saving…" : shown ? "Visible" : "Hidden"}</span>
        <HelpTooltip label="Help: Organization login visibility">Hide the organization name, logo, and public notices from the login page. Existing accounts can still log in and use their classes.</HelpTooltip>
      </div>
    </div>
    {message ? <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-red-700" : "text-slate-600"}`}>{message}</p> : null}
  </div>
}
