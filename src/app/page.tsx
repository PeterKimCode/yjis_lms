import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPostLoginPath } from "@/modules/auth/roles"
import { getCurrentSession } from "@/modules/auth/session"

export default async function Home() {
  const session = await getCurrentSession()
  const dashboardHref = session?.user
    ? getPostLoginPath(session.user.roleAssignments)
    : "/login"

  return (
    <main className="app-shell-surface flex-1 px-4 py-10">
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="space-y-3">
            <Badge variant="secondary">Local self-hosted LMS</Badge>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
              School-managed learning, attendance, grades, and communication.
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              This initial workspace is wired for local PostgreSQL, Redis,
              MinIO, Prisma, and Auth.js credentials authentication.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {session?.user ? (
              <Button asChild>
                <Link href={dashboardHref}>Go to dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Login</Link>
              </Button>
            )}
          </div>
        </div>

        <Card className="lms-card">
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {session?.user ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-medium">{session.user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Roles</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {session.user.roleAssignments.map((assignment) => (
                      <Badge key={assignment.role} variant="outline">
                        {assignment.role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active session. Use one of the seeded local accounts to test
                authentication.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
