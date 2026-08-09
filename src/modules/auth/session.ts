import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/modules/auth/auth"

export async function getCurrentSession() {
  const session = await getServerSession(authOptions)

  if (
    session?.fixedSessionExpiresAt &&
    session.fixedSessionExpiresAt <= Date.now()
  ) {
    return null
  }

  return session
}

export async function requireAuth() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  return session
}
