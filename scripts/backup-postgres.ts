import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { spawn } from "node:child_process"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run a database backup.")
  process.exit(1)
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
const outputPath =
  process.argv.find((value) => value.startsWith("--output="))?.slice(9) ??
  join(process.cwd(), "backups", `lms-${timestamp}.dump`)

mkdirSync(dirname(outputPath), { recursive: true })

const child = spawn(
  "pg_dump",
  ["--format=custom", "--no-owner", "--no-privileges", "--file", outputPath, databaseUrl],
  {
    shell: process.platform === "win32",
    stdio: "inherit",
  }
)

child.on("error", (error) => {
  console.error("Could not start pg_dump.")
  console.error(error.message)
  console.error("")
  console.error("Install PostgreSQL client tools or run pg_dump from the DB host.")
  process.exit(1)
})

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`Database backup created: ${outputPath}`)
    process.exit(0)
  }

  console.error(`pg_dump exited with code ${code ?? "unknown"}.`)
  process.exit(code ?? 1)
})
