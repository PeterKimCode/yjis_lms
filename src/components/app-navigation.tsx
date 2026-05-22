import Link from "next/link"
import Image from "next/image"
import { LogIn } from "lucide-react"

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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link className="flex items-center gap-2 font-semibold tracking-tight" href="/">
          <Image
            alt="YJIS LMS"
            className="h-9 w-auto"
            height={36}
            src="/brand/yjis-lms-logo.svg"
            width={120}
          />
        </Link>
        <nav className="flex items-center gap-2">
          <BackButton />
          {session?.user ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href={dashboardHref}>Dashboard</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/messages">
                  Messages
                  <NavBadge count={unreadMessages} />
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/notifications">
                  Notifications
                  <NavBadge count={unreadNotifications} />
                </Link>
              </Button>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">{roleSummary}</p>
              </div>
              <GoogleTranslateControl />
              <AvatarMenu
                avatarUrl={
                  avatar ? `/api/files/${avatar.id}/download?disposition=inline` : null
                }
                userName={session.user.name ?? session.user.email ?? "User"}
              />
              <LogoutButton size="sm" />
            </>
          ) : (
            <>
              <GoogleTranslateControl />
              <Button asChild size="sm">
                <Link href="/login">
                  <LogIn />
                  Login
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
    <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
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
