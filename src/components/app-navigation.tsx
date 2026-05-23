import Link from "next/link"
import { Bell, Home, LogIn, MessageSquare } from "lucide-react"

import { BackButton } from "@/components/back-button"
import { GoogleTranslateControl } from "@/components/google-translate-control"
import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { AvatarMenu } from "@/modules/auth/avatar-menu"
import { LogoutButton } from "@/modules/auth/logout-button"
import { getCurrentSession } from "@/modules/auth/session"
import { getUnreadMessageCount } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"

export async function AppNavigation() {
  const session = await getCurrentSession()
  const [unreadMessages, unreadNotifications, avatar] = session?.user
    ? await Promise.all([
        getUnreadMessageCount(session.user.id),
        getUnreadNotificationCount(session.user.id),
        getUserAvatar(session.user.id),
      ])
    : [0, 0, null]
  const roleSummary =
    session?.user.roleAssignments.map((assignment) => assignment.role).join(", ") ??
    ""
  const dashboardHref = session?.user
    ? getDashboardHref(session.user.roleAssignments.map((assignment) => assignment.role))
    : "/"

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-slate-100 shadow-sm shadow-slate-950/20">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link
          className="max-w-[42vw] truncate text-sm font-semibold tracking-tight text-white sm:max-w-none sm:text-base"
          href="/"
        >
          General Trias College of Cavite
        </Link>
        <nav className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Button
                asChild
                className="text-slate-100 hover:bg-white/10 hover:text-white"
                size="icon-sm"
                variant="ghost"
              >
                <Link href={dashboardHref} title="Dashboard">
                  <Home />
                  <span className="sr-only">Dashboard</span>
                </Link>
              </Button>
              <Button
                asChild
                className="relative text-slate-100 hover:bg-white/10 hover:text-white"
                size="icon-sm"
                variant="ghost"
              >
                <Link href="/messages" title="Messages">
                  <MessageSquare />
                  <span className="sr-only">Messages</span>
                  <NavBadge count={unreadMessages} />
                </Link>
              </Button>
              <Button
                asChild
                className="relative text-slate-100 hover:bg-white/10 hover:text-white"
                size="icon-sm"
                variant="ghost"
              >
                <Link href="/notifications" title="Notifications">
                  <Bell />
                  <span className="sr-only">Notifications</span>
                  <NavBadge count={unreadNotifications} />
                </Link>
              </Button>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">{session.user.name}</p>
                <p className="text-xs text-slate-400">{roleSummary}</p>
              </div>
              <AvatarMenu
                avatarUrl={
                  avatar ? `/api/files/${avatar.id}/download?disposition=inline` : null
                }
                userName={session.user.name ?? session.user.email ?? "User"}
              />
              <BackButton className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" />
              <LogoutButton
                className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                size="sm"
              />
              <GoogleTranslateControl />
            </>
          ) : (
            <>
              <BackButton className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" />
              <GoogleTranslateControl />
              <Button asChild size="sm">
                <Link href="/login">
                  <LogIn />
                  Log In
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

async function getUserAvatar(userId: string) {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: {
      avatarFileAsset: {
        select: { id: true },
      },
    },
  })

  return user?.avatarFileAsset ?? null
}

function NavBadge({ count }: { count: number }) {
  return count ? (
    <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground ring-2 ring-slate-950">
      {count > 99 ? "99+" : count}
    </span>
  ) : null
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
