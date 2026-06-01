import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function getDatabasePoolMax() {
  const value = Number(process.env.DATABASE_POOL_MAX ?? 5)
  return Number.isInteger(value) && value > 0 ? value : 5
}

export function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to the database.")
  }

  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: getDatabasePoolMax(),
  })
  const prisma = new PrismaClient({ adapter })

  globalForPrisma.prisma = prisma

  return prisma
}
