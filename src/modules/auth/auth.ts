import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { NotificationType, UserRole } from "@prisma/client"
import Redis from "ioredis"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import { verifyPassword } from "@/modules/auth/password"
import { createNotificationsForUsers } from "@/modules/notifications/service"

const credentialsSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
})

const sessionMaxAgeSeconds = 60 * 60
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

const redisGlobal =
  globalThis as typeof globalThis & {
    __lmsRedis?: Redis
  }

function getRateLimitRedis() {
  if (!process.env.REDIS_URL) return null
  if (!redisGlobal.__lmsRedis) {
    redisGlobal.__lmsRedis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
  }

  return redisGlobal.__lmsRedis
}

export type SessionRoleAssignment = {
  role: string
  organizationId: string
  campusId: string | null
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: sessionMaxAgeSeconds,
    updateAge: 5 * 60,
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
      name: "Login ID and password",
      credentials: {
        email: { label: "Login ID", type: "text" },
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
        } else if (await isLoginRateLimited(email)) {
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
            if (
              user.roleAssignments.some((assignment) =>
                adminLoginRoles.has(assignment.role)
              )
            ) {
              await writeLoginAudit({
                action: "auth.admin.login.success",
                actorUserId: user.id,
                organizationId: user.organizationId,
                summary: "Admin login succeeded.",
                userId: user.id,
              })
            }
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              roleAssignments: user.roleAssignments,
            }
          }
        }

        const auditUser = usableUsers[0]
        if (auditUser) {
            await writeLoginAudit({
              action: isAdminLogin
                ? "auth.admin.login.failed"
              : "auth.login.failed",
            organizationId: auditUser.organizationId,
            summary: isAdminLogin
              ? "Admin login failed."
              : "Login failed for an existing account.",
            userId: auditUser.id,
          })
        }

        if (!isAdminLogin) {
          const isLocked = await recordFailedLogin(email)
          if (isLocked && auditUser) {
            await writeLoginAudit({
              action: "auth.login.locked",
              organizationId: auditUser.organizationId,
              summary: "Account temporarily locked after repeated failed logins.",
              userId: auditUser.id,
            })
            await notifySecurityAdmins({
              actorUserId: auditUser.id,
              body: `${auditUser.email} was temporarily locked after repeated failed login attempts.`,
              organizationId: auditUser.organizationId,
              title: "Repeated failed login attempts",
              userId: auditUser.id,
            })
          }
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

async function isLoginRateLimited(email: string) {
  const redis = getRateLimitRedis()
  if (redis) {
    try {
      const lockedUntil = await redis.get(getLoginLockKey(email))
      if (!lockedUntil) return false

      return Number(lockedUntil) > Date.now()
    } catch (error) {
      console.error("Redis login rate-limit read failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

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

async function recordFailedLogin(email: string) {
  const redis = getRateLimitRedis()
  if (redis) {
    try {
      const attemptKey = getLoginAttemptKey(email)
      const lockKey = getLoginLockKey(email)
      const count = await redis.incr(attemptKey)

      if (count === 1) {
        await redis.pexpire(attemptKey, loginWindowMs)
      }
      if (count >= maxLoginAttempts) {
        const lockedUntil = Date.now() + loginLockoutMs
        await redis.psetex(lockKey, loginLockoutMs, String(lockedUntil))
        return true
      }
      return false
    } catch (error) {
      console.error("Redis login rate-limit write failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

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
  return Boolean(attempt.lockedUntil && attempt.lockedUntil > now)
}

function clearLoginAttempts(email: string) {
  const redis = getRateLimitRedis()
  if (redis) {
    redis
      .del(getLoginAttemptKey(email), getLoginLockKey(email))
      .catch((error: unknown) => {
        console.error("Redis login rate-limit clear failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }
  loginAttemptStore.delete(email)
}

function getLoginAttemptKey(email: string) {
  return `lms:login-attempt:${email}`
}

function getLoginLockKey(email: string) {
  return `lms:login-lock:${email}`
}

async function writeLoginAudit({
  action,
  actorUserId = null,
  organizationId,
  summary,
  userId,
}: {
  action: string
  actorUserId?: string | null
  organizationId: string
  summary: string
  userId: string
}) {
  await writeAuditLog({
    action,
    actorUserId,
    entityId: userId,
    entityType: "User",
    metadata: {
      source: "credentials",
    },
    organizationId,
    summary,
  })
}

async function notifySecurityAdmins({
  actorUserId,
  body,
  organizationId,
  title,
  userId,
}: {
  actorUserId: string
  body: string
  organizationId: string
  title: string
  userId: string
}) {
  const admins = await getPrismaClient().userRoleAssignment.findMany({
    where: {
      organizationId,
      role: {
        in: [
          UserRole.SUPER_ADMIN,
          UserRole.ORG_ADMIN,
          UserRole.SCHOOL_ADMIN,
          UserRole.ACADEMIC_STAFF,
        ],
      },
      user: { isActive: true },
    },
    select: { userId: true },
  })

  await createNotificationsForUsers(
    admins.map((admin) => admin.userId),
    {
      actionUrl: `/admin/users/${userId}`,
      actorUserId,
      body,
      entityId: userId,
      entityType: "User",
      title,
      type: NotificationType.SYSTEM_NOTICE,
    }
  )
}
