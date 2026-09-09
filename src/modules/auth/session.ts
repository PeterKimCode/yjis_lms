import { getServerSession } from "next-auth"
import { cache } from "react"
import { redirect } from "next/navigation"

import { authOptions } from "@/modules/auth/auth"

export const getCurrentSession = cache(async () => {
  const session = await getServerSession(authOptions)

  if (
    session?.fixedSessionExpiresAt &&
    session.fixedSessionExpiresAt <= Date.now()
  ) {
    return null
  }

  return session
})

export async function requireAuth() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  return session
}
