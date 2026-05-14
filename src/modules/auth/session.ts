import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/modules/auth/auth"

export function getCurrentSession() {
  return getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  return session
}
