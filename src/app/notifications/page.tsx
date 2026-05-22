import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  archiveNotificationAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  openNotificationAction,
} from "@/modules/notifications/actions"
import { getNotificationCenter } from "@/modules/notifications/data"
import { MarkAllNotificationsReadButton } from "@/modules/notifications/notification-actions"
import { notificationFilters } from "@/modules/notifications/types"
import { StatusBadge } from "@/modules/dashboards/components"

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const params = await searchParams
  const { filter, notifications, q, user } = await getNotificationCenter({
    filter: params.filter ?? "all",
    q: params.q ?? "",
  })
  const unreadNotifications = notifications.filter(
    (notification) => !notification.readAt
  )
  const readNotifications = notifications.filter((notification) => notification.readAt)

  return (
    <main className="app-shell-surface flex-1 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Button asChild size="sm" variant="outline">
          <Link href={getDashboardHref(user.roleAssignments.map((item) => item.role))}>
            Back
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            In-app LMS alerts. Counts update on page load and navigation.
          </p>
        </div>

        <div className="lms-soft-panel flex flex-col gap-3 rounded-lg p-4">
          <form className="flex flex-col gap-2 md:flex-row">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm md:max-w-sm"
              defaultValue={q}
              name="q"
              placeholder="Search notifications..."
            />
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              defaultValue={filter}
              name="filter"
            >
              {notificationFilters.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                Filter
              </Button>
              <Button asChild type="button" variant="ghost">
                <Link href="/notifications">Reset</Link>
              </Button>
            </div>
          </form>
          <MarkAllNotificationsReadButton />
        </div>

        {notifications.length ? (
          <div className="space-y-6">
            {unreadNotifications.length ? (
              <NotificationGroup
                notifications={unreadNotifications}
                title={`Unread (${unreadNotifications.length})`}
              />
            ) : null}
            {readNotifications.length ? (
              <NotificationGroup
                notifications={readNotifications}
                title={unreadNotifications.length ? "Earlier" : "All notifications"}
              />
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        )}
      </div>
    </main>
  )
}

function NotificationGroup({
  notifications,
  title,
}: {
  notifications: Awaited<ReturnType<typeof getNotificationCenter>>["notifications"]
  title: string
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-3">
        {notifications.map((notification) => (
          <article
            className={`lms-card rounded-lg p-4 ${
              notification.readAt ? "" : "border-primary/50 bg-primary/5"
            }`}
            key={notification.id}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={notification.typeLabel} value={notification.type} />
                  {!notification.readAt ? (
                    <StatusBadge label="Unread" value="PENDING" />
                  ) : null}
                </div>
                <h3 className="font-semibold">{notification.title}</h3>
                {notification.body ? (
                  <p className="text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {formatDate(notification.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {notification.actionUrl ? (
                  <form action={openNotificationAction}>
                    <input
                      name="notificationId"
                      type="hidden"
                      value={notification.id}
                    />
                    <Button size="sm" type="submit">
                      Open
                    </Button>
                  </form>
                ) : null}
                <form
                  action={
                    notification.readAt
                      ? markNotificationUnreadAction
                      : markNotificationReadAction
                  }
                >
                  <input
                    name="notificationId"
                    type="hidden"
                    value={notification.id}
                  />
                  <Button size="sm" type="submit" variant="outline">
                    {notification.readAt ? "Mark unread" : "Mark read"}
                  </Button>
                </form>
                <form action={archiveNotificationAction}>
                  <input
                    name="notificationId"
                    type="hidden"
                    value={notification.id}
                  />
                  <Button size="sm" type="submit" variant="destructive">
                    Archive
                  </Button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

function getDashboardHref(roles: string[]) {
  if (
    roles.some((role) =>
      ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "ACADEMIC_STAFF"].includes(
        role
      )
    )
  ) {
    return "/admin"
  }
  if (roles.some((role) => ["INSTRUCTOR", "HOMEROOM_TEACHER"].includes(role))) {
    return "/instructor"
  }
  if (roles.includes("STUDENT")) return "/student"
  if (roles.includes("PARENT")) return "/parent"

  return "/"
}
