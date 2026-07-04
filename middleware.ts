import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

type RoleAssignmentToken = {
  role?: string
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? "local-development-only-nextauth-secret",
  })
  const roleAssignments = Array.isArray(token?.roleAssignments)
    ? (token.roleAssignments as RoleAssignmentToken[])
    : []
  const roles = new Set(roleAssignments.map((assignment) => assignment.role))
  const isSchoolAdminOnly =
    roles.has("SCHOOL_ADMIN") && !roles.has("SUPER_ADMIN")

  if (
    isSchoolAdminOnly &&
    pathname !== "/admin/users" &&
    !pathname.startsWith("/admin/users/")
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/users"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
