import type { DefaultSession } from "next-auth"
import type { DefaultJWT } from "next-auth/jwt"

import type { SessionRoleAssignment } from "@/modules/auth/auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      roleAssignments: SessionRoleAssignment[]
    } & DefaultSession["user"]
  }

  interface User {
    roleAssignments?: SessionRoleAssignment[]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    roleAssignments?: SessionRoleAssignment[]
  }
}
