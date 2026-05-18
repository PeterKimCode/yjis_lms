"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { markAllNotificationsReadAction } from "@/modules/notifications/actions"
import { initialNotificationActionState } from "@/modules/notifications/types"

export function MarkAllNotificationsReadButton() {
  const [state, formAction] = useActionState(
    markAllNotificationsReadAction,
    initialNotificationActionState
  )

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Button size="sm" type="submit" variant="outline">
        Mark all as read
      </Button>
      {state.message ? (
        <span className="text-sm text-muted-foreground">{state.message}</span>
      ) : null}
    </form>
  )
}
