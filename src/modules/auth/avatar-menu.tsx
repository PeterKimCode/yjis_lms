"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Image from "next/image"

import { GoogleTranslateControl } from "@/components/google-translate-control"
import { Button } from "@/components/ui/button"
import {
  type AvatarUploadState,
  updateCurrentUserAvatar,
} from "@/modules/auth/avatar-actions"
import { LogoutButton } from "@/modules/auth/logout-button"

const initialState: AvatarUploadState = { ok: true, message: "" }

export function AvatarMenu({
  avatarUrl,
  roleSummary,
  userName,
}: {
  avatarUrl: string | null
  roleSummary?: string
  userName: string
}) {
  const [state, formAction, pending] = useActionState(
    updateCurrentUserAvatar,
    initialState
  )
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok && state.message) {
      formRef.current?.reset()
      const timeoutId = window.setTimeout(() => setOpen(false), 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [state])

  return (
    <details
      className="relative"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center overflow-hidden rounded-full border border-white/20 bg-white shadow-sm">
        {avatarUrl ? (
          <Image
            alt={`${userName} profile photo`}
            className="h-full w-full object-cover"
            height={36}
            src={avatarUrl}
            width={36}
            unoptimized
          />
        ) : (
          <span className="text-sm font-semibold text-primary">
            {userName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border bg-white p-3 text-slate-950 shadow-lg">
        <p className="text-sm font-semibold">{userName}</p>
        {roleSummary ? (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
            {roleSummary}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a profile image. JPG, PNG, WEBP, or GIF only. Max 10MB.
        </p>
        <form action={formAction} className="mt-3 grid gap-2" ref={formRef}>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700"
            name="avatar"
            type="file"
          />
          <Button size="sm" type="submit" disabled={pending}>
            {pending ? "Uploading..." : "Save photo"}
          </Button>
        </form>
        {state.message ? (
          <p
            className={`mt-2 text-xs ${
              state.ok ? "text-emerald-700" : "text-destructive"
            }`}
          >
            {state.message}
          </p>
        ) : null}
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Language
          </p>
          <GoogleTranslateControl className="w-full justify-between border-slate-200 bg-slate-50 text-slate-800" />
        </div>
        <div className="mt-3">
          <LogoutButton className="w-full justify-center" size="sm" />
        </div>
      </div>
    </details>
  )
}
