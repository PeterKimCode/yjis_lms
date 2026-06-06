import "dotenv/config"

import { getPrismaClient } from "../src/lib/prisma"

const args = new Map(
  process.argv
    .slice(2)
    .map((arg) => {
      const [key, value = ""] = arg.replace(/^--/, "").split("=")
      return [key, value]
    })
)
const days = Number(args.get("days") ?? "365")
const dryRun = args.has("dry-run")

if (!Number.isInteger(days) || days < 30) {
  console.error("Use --days=<number>, minimum 30 days.")
  process.exit(1)
}

const cutoff = new Date()
cutoff.setDate(cutoff.getDate() - days)

main().catch((error) => {
  console.error("Audit log prune failed.")
  const errorCode =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : null

  if (errorCode === "ECONNREFUSED") {
    console.error("The database refused the connection.")
  } else {
    console.error(
      error instanceof Error
        ? error.message.split("\n")[0]
        : "Unknown error while pruning audit logs."
    )
  }
  console.error("")
  console.error("Check DATABASE_URL and confirm the database is reachable.")
  process.exit(1)
})

async function main() {
  const prisma = getPrismaClient()
  const count = await prisma.auditLog.count({
    where: {
      createdAt: { lt: cutoff },
    },
  })

  if (dryRun) {
    console.log(
      `Dry run: ${count} audit log(s) older than ${days} day(s) would be deleted.`
    )
    return
  }

  const deleted = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  })

  console.log(
    `Deleted ${deleted.count} audit log(s) older than ${days} day(s).`
  )
}
