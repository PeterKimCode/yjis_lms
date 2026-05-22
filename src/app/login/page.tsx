import { redirect } from "next/navigation"

import { LoginForm } from "@/modules/auth/login-form"
import { getPostLoginPath } from "@/modules/auth/roles"
import { getCurrentSession } from "@/modules/auth/session"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const session = await getCurrentSession()
  const params = await searchParams

  if (session?.user?.id) {
    redirect(getPostLoginPath(session.user.roleAssignments))
  }

  return (
    <main className="app-shell-surface min-h-[calc(100vh-4rem)] px-4 py-12">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Use a school-managed account to access the LMS.
          </p>
        </div>
        <LoginForm
          callbackUrl="/login/redirect"
          hasError={params.error === "CredentialsSignin"}
        />
      </div>
    </main>
  )
}
