import { redirect } from "next/navigation"
import Image from "next/image"
import { LoginForm } from "@/modules/auth/login-form"
import { getPostLoginPath } from "@/modules/auth/roles"
import { getCurrentSession } from "@/modules/auth/session"

export const metadata = { title: "Log in", description: "Access your school LMS with your school-managed login ID." }

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; expired?: string }>
}) {
  const session = await getCurrentSession()
  const params = await searchParams
  if (session?.user?.id) redirect(getPostLoginPath(session.user.roleAssignments))
  return <main className="app-shell-surface flex flex-1 items-center px-4 py-10 sm:py-16">
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-3">
        <Image src="/icon.svg" alt="" width={48} height={48} />
        <h1 className="text-2xl font-semibold">Log in to your LMS</h1>
        <p className="text-sm text-muted-foreground">Access your classes, assignments, grades, and school messages.</p>
      </div>
      <LoginForm callbackUrl="/login/redirect" hasError={params.error === "CredentialsSignin"} initialMessage={params.expired === "1" ? "Session expired. Please log in again." : undefined} />
      <p className="text-sm text-muted-foreground">Use the login ID provided by your school. For account or password help, contact your school administrator.</p>
    </div>
  </main>
}
