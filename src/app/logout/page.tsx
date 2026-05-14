import { redirect } from "next/navigation"

import { LogoutButton } from "@/modules/auth/logout-button"
import { getCurrentSession } from "@/modules/auth/session"

export default async function LogoutPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-muted/40 px-4 py-12">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign out</h1>
          <p className="text-sm text-muted-foreground">
            End the current LMS session for {session.user.email}.
          </p>
        </div>
        <LogoutButton className="w-full" />
      </div>
    </main>
  )
}
