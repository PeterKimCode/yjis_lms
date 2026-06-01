import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, UserRole } from "@prisma/client"

type Args = {
  campusCode?: string
  campusId?: string
  campusName?: string
  email?: string
  organizationId?: string
  organizationSlug?: string
  role: UserRole
}

const adminRoles = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.ACADEMIC_STAFF,
])

function parseArgs(argv: string[]): Args {
  const args: Args = { role: UserRole.SUPER_ADMIN }

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    const value = argv[index + 1]

    if (!key.startsWith("--")) continue
    if (!value || value.startsWith("--")) {
      throw new Error(`${key} requires a value.`)
    }

    index += 1

    if (key === "--email") args.email = value.toLowerCase()
    if (key === "--role") args.role = value as UserRole
    if (key === "--organization-id") args.organizationId = value
    if (key === "--organization-slug") args.organizationSlug = value
    if (key === "--campus-id") args.campusId = value
    if (key === "--campus-code") args.campusCode = value
    if (key === "--campus-name") args.campusName = value
  }

  if (!args.email) {
    throw new Error("Usage: npm run admin:repair-access -- --email admin@example.com")
  }

  if (!adminRoles.has(args.role)) {
    throw new Error(
      `Role must be one of: ${Array.from(adminRoles).join(", ")}. Received: ${args.role}`
    )
  }

  return args
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.")
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 2),
    }),
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const prisma = createPrisma()

  try {
    const users = await prisma.user.findMany({
      where: {
        email: args.email,
        ...(args.organizationId ? { organizationId: args.organizationId } : {}),
        ...(args.organizationSlug
          ? { organization: { slug: args.organizationSlug } }
          : {}),
      },
      include: {
        organization: true,
        roleAssignments: {
          include: { campus: true, organization: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    if (users.length === 0) {
      throw new Error(`No active or inactive user found for email ${args.email}.`)
    }

    if (users.length > 1) {
      console.log("Multiple users use this email. Re-run with --organization-slug or --organization-id.")
      for (const user of users) {
        console.log(`- ${user.email} | ${user.name} | ${user.organization.name} | ${user.organization.slug}`)
      }
      process.exitCode = 1
      return
    }

    const user = users[0]
    let campusId: string | null = null

    if (args.role === UserRole.SCHOOL_ADMIN || args.role === UserRole.ACADEMIC_STAFF) {
      const campus = await prisma.campus.findFirst({
        where: {
          organizationId: user.organizationId,
          ...(args.campusId ? { id: args.campusId } : {}),
          ...(args.campusCode ? { code: args.campusCode } : {}),
          ...(args.campusName ? { name: args.campusName } : {}),
        },
        orderBy: { createdAt: "asc" },
      })

      if (!campus && args.role === UserRole.SCHOOL_ADMIN) {
        throw new Error(
          "SCHOOL_ADMIN requires a campus. Pass --campus-id, --campus-code, or --campus-name."
        )
      }

      campusId = campus?.id ?? null
    }

    const existing = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: user.id,
        organizationId: user.organizationId,
        role: args.role,
      },
    })

    if (existing) {
      await prisma.userRoleAssignment.update({
        where: { id: existing.id },
        data: {
          campusId,
          startsAt: null,
          endsAt: null,
        },
      })
    } else {
      await prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          campusId,
          role: args.role,
        },
      })
    }

    if (!user.isActive) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      })
    }

    const repaired = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organization: true,
        roleAssignments: {
          include: { campus: true },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    console.log("Admin access repaired.")
    console.log(`User: ${repaired?.name} <${repaired?.email}>`)
    console.log(`Organization: ${repaired?.organization.name}`)
    console.log("Roles:")
    for (const assignment of repaired?.roleAssignments ?? []) {
      console.log(
        `- ${assignment.role} | campus: ${assignment.campus?.name ?? "organization-wide"} | startsAt: ${
          assignment.startsAt?.toISOString() ?? "none"
        } | endsAt: ${assignment.endsAt?.toISOString() ?? "none"}`
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
