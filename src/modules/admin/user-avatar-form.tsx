"use client"

import { useActionState, useEffect, useRef } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  type AdminUserAvatarState,
  removeAdminUserAvatar,
  updateAdminUserAvatar,
} from "@/modules/admin/actions"

const initialState: AdminUserAvatarState = { ok: true, message: "" }

export function AdminUserAvatarForm({
  avatarUrl,
  userId,
  userName,
}: {
  avatarUrl: string | null
  userId: string
  userName: string
}) {
  const uploadFormRef = useRef<HTMLFormElement>(null)
  const [uploadState, uploadAction, uploadPending] = useActionState(
    updateAdminUserAvatar,
    initialState
  )
  const [removeState, removeAction, removePending] = useActionState(
    removeAdminUserAvatar,
    initialState
  )

  useEffect(() => {
    if (uploadState.ok && uploadState.message) {
      uploadFormRef.current?.reset()
    }
  }, [uploadState])

  const message = uploadState.message || removeState.message
  const ok = uploadState.message ? uploadState.ok : removeState.ok

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border bg-slate-50">
          {avatarUrl ? (
            <Image
              alt={`${userName} profile photo`}
              className="h-full w-full object-cover"
              height={80}
              src={avatarUrl}
              width={80}
              unoptimized
            />
          ) : (
            <span className="text-2xl font-semibold text-primary">
              {userName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Profile photo</h3>
            <p className="text-xs text-muted-foreground">
              Admins can upload or remove this user&apos;s profile image. JPG, PNG,
              WEBP, or GIF only. Max 10MB.
            </p>
          </div>
          <form
            action={uploadAction}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            ref={uploadFormRef}
          >
            <input name="userId" type="hidden" value={userId} />
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700"
              name="avatar"
              type="file"
            />
            <Button size="sm" type="submit" disabled={uploadPending}>
              {uploadPending ? "Uploading..." : "Save photo"}
            </Button>
          </form>
          <form action={removeAction}>
            <input name="userId" type="hidden" value={userId} />
            <Button
              size="sm"
              type="submit"
              variant="destructive"
              disabled={removePending}
            >
              {removePending ? "Removing..." : "Remove photo"}
            </Button>
          </form>
          {message ? (
            <p
              className={`text-xs ${
                ok ? "text-emerald-700" : "text-destructive"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
