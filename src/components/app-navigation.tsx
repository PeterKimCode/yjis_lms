import Link from "next/link"
import { Bell, Home, LogIn, MessageSquare } from "lucide-react"

import { BackButton } from "@/components/back-button"
import { GoogleTranslateControl } from "@/components/google-translate-control"
import { SessionCountdown } from "@/components/session-countdown"
import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { AvatarMenu } from "@/modules/auth/avatar-menu"
import { getCurrentSession } from "@/modules/auth/session"
import { getUnreadMessageCount } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"

export async function AppNavigation() {
  const session = await getCurrentSession()
  const [unreadMessages, unreadNotifications, headerUser] = session?.user
    ? await Promise.all([
        getUnreadMessageCount(session.user.id),
        getUnreadNotificationCount(session.user.id),
        getHeaderUser(session.user.id),
      ])
    : [0, 0, null]
  const roleSummary =
    session?.user.roleAssignments.map((assignment) => assignment.role).join(", ") ??
    ""
  const dashboardHref = session?.user
    ? getDashboardHref(session.user.roleAssignments.map((assignment) => assignment.role))
    : "/"
  const headerTitle = headerUser?.organization?.name ?? "Learning Management System"

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-slate-100 shadow-sm shadow-slate-950/20">
      <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <Link
          className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-white sm:text-base"
          href="/"
          title={headerTitle}
        >
          <span className="block truncate sm:hidden">
            {session?.user ? headerTitle : "LMS"}
          </span>
          <span className="hidden truncate sm:block">{headerTitle}</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium text-white">{session.user.name}</p>
                <p className="text-xs text-slate-400">{roleSummary}</p>
              </div>
              <div className="hidden lg:block">
                <SessionCountdown compact />
              </div>
              <AvatarMenu
                avatarUrl={
                  headerUser?.avatarFileAsset
                    ? `/api/files/${headerUser.avatarFileAsset.id}/download?disposition=inline`
                    : null
                }
                roleSummary={roleSummary}
                userName={session.user.name ?? session.user.email ?? "User"}
              />
              <BackButton
                className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                showLabel={false}
              />
            </>
          ) : (
            <>
              <BackButton
                className="border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                showLabel={false}
              />
              <GoogleTranslateControl className="hidden sm:flex" />
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

async function getHeaderUser(userId: string) {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: {
      avatarFileAsset: {
        select: { id: true },
      },
      organization: {
        select: { name: true },
      },
    },
  })

  return user
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
