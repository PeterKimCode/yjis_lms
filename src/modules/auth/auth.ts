import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { verifyPassword } from "@/modules/auth/password"

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
})

const sessionMaxAgeSeconds = 8 * 60 * 60
const loginWindowMs = 5 * 60 * 1000
const loginLockoutMs = 15 * 60 * 1000
const maxLoginAttempts = 5
const adminLoginRoles = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.ACADEMIC_STAFF,
])

type LoginAttempt = {
  count: number
  firstAttemptAt: number
  lockedUntil?: number
}

const loginAttempts =
  globalThis as typeof globalThis & {
    __lmsLoginAttempts?: Map<string, LoginAttempt>
  }

const loginAttemptStore =
  loginAttempts.__lmsLoginAttempts ?? new Map<string, LoginAttempt>()

loginAttempts.__lmsLoginAttempts = loginAttemptStore

export type SessionRoleAssignment = {
  role: string
  organizationId: string
  campusId: string | null
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: sessionMaxAgeSeconds,
    updateAge: 60 * 60,
  },
  jwt: {
    maxAge: sessionMaxAgeSeconds,
  },
  pages: {
    signIn: "/login",
    signOut: "/logout",
  },
  secret: process.env.NEXTAUTH_SECRET ?? "local-development-only-nextauth-secret",
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = credentialsSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          return null
        }

        const { email, password } = parsedCredentials.data

        const prisma = getPrismaClient()
        const users = await prisma.user.findMany({
          where: {
            email,
          },
          include: {
            organization: {
              select: {
                id: true,
                isActive: true,
              },
            },
            roleAssignments: {
              select: {
                role: true,
                organizationId: true,
                campusId: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        })
        const activeUsers = users.filter((user) => user.isActive)
        const isAdminLogin = activeUsers.some((user) =>
          user.roleAssignments.some((assignment) =>
            adminLoginRoles.has(assignment.role)
          )
        )

        if (users.length > 0 && activeUsers.length === 0) {
          throw new Error("AccountInactive")
        }

        if (isAdminLogin) {
          clearLoginAttempts(email)
        } else if (isLoginRateLimited(email)) {
          throw new Error("AccountLocked")
        }

        const usableUsers = activeUsers.filter((user) => user.organization?.isActive)

        if (activeUsers.length > 0 && usableUsers.length === 0) {
          throw new Error("OrganizationUnavailable")
        }

        const hasPasswordConfigured = usableUsers.some((user) => user.passwordHash)

        if (usableUsers.length > 0 && !hasPasswordConfigured) {
          throw new Error("AccountNotConfigured")
        }

        for (const user of usableUsers) {
          if (!user.passwordHash) {
            continue
          }

          const isValidPassword = await verifyPassword(password, user.passwordHash)

          if (isValidPassword) {
            clearLoginAttempts(email)
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              roleAssignments: user.roleAssignments,
            }
          }
        }

        if (!isAdminLogin) {
          recordFailedLogin(email)
        }
        return null
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.roleAssignments = user.roleAssignments ?? []
      }

      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.roleAssignments = token.roleAssignments ?? []
      }

      return session
    },
  },
}

function isLoginRateLimited(email: string) {
  const attempt = loginAttemptStore.get(email)
  const now = Date.now()

  if (!attempt) return false
  if (attempt.lockedUntil && attempt.lockedUntil > now) return true
  if (attempt.lockedUntil && attempt.lockedUntil <= now) {
    loginAttemptStore.delete(email)
    return false
  }
  if (now - attempt.firstAttemptAt > loginWindowMs) {
    loginAttemptStore.delete(email)
    return false
  }

  return attempt.count >= maxLoginAttempts
}

function recordFailedLogin(email: string) {
  const now = Date.now()
  const existing = loginAttemptStore.get(email)
  const attempt =
    existing && now - existing.firstAttemptAt <= loginWindowMs
      ? existing
      : { count: 0, firstAttemptAt: now }

  attempt.count += 1
  if (attempt.count >= maxLoginAttempts) {
    attempt.lockedUntil = now + loginLockoutMs
  }

  loginAttemptStore.set(email, attempt)
}

function clearLoginAttempts(email: string) {
  loginAttemptStore.delete(email)
}
