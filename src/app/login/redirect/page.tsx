import { redirect } from "next/navigation"

import { getPostLoginPath } from "@/modules/auth/roles"
import { getCurrentSession } from "@/modules/auth/session"

export default async function LoginRedirectPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  redirect(getPostLoginPath(session.user.roleAssignments))
}
