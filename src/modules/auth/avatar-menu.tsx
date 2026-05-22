"use client"

import { useActionState } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  type AvatarUploadState,
  updateCurrentUserAvatar,
} from "@/modules/auth/avatar-actions"

const initialState: AvatarUploadState = { ok: true, message: "" }

export function AvatarMenu({
  avatarUrl,
  userName,
}: {
  avatarUrl: string | null
  userName: string
}) {
  const [state, formAction, pending] = useActionState(
    updateCurrentUserAvatar,
    initialState
  )

  return (
    <details className="relative">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center overflow-hidden rounded-full border bg-white shadow-sm">
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
      <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold">{userName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a profile image. JPG, PNG, WEBP, or GIF only. Max 10MB.
        </p>
        <form action={formAction} className="mt-3 grid gap-2">
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="text-xs"
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
      </div>
    </details>
  )
}
