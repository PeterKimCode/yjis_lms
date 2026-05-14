import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { verifyPassword } from "@/modules/auth/password"

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
})

export type SessionRoleAssignment = {
  role: string
  organizationId: string
  campusId: string | null
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
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
        const user = await prisma.user.findFirst({
          where: {
            email,
            isActive: true,
          },
          include: {
            roleAssignments: {
              select: {
                role: true,
                organizationId: true,
                campusId: true,
              },
            },
          },
        })

        if (!user?.passwordHash) {
          return null
        }

        const isValidPassword = await verifyPassword(password, user.passwordHash)

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleAssignments: user.roleAssignments,
        }
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
