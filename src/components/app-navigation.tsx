import Link from "next/link"
import { LogIn, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getCurrentSession } from "@/modules/auth/session"

export async function AppNavigation() {
  const session = await getCurrentSession()
  const roleSummary =
    session?.user.roleAssignments.map((assignment) => assignment.role).join(", ") ??
    ""

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link className="font-semibold tracking-tight" href="/">
          LMS Platform
        </Link>
        <nav className="flex items-center gap-3">
          {session?.user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">{roleSummary}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/logout">
                  <LogOut />
                  Logout
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">
                <LogIn />
                Login
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
