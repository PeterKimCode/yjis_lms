import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = join(process.cwd(), "src")
const actionFilePattern = /actions\.ts$/
const unsafePatterns = [
  { label: "throw new Error", pattern: /throw new Error\(/ },
  { label: "PermissionError throw", pattern: /throw new PermissionError\(/ },
]

type Finding = {
  file: string
  line: number
  label: string
  text: string
}

function walk(directory: string, files: string[] = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue
      walk(fullPath, files)
      continue
    }

    if (actionFilePattern.test(entry)) files.push(fullPath)
  }

  return files
}

const findings: Finding[] = []

for (const file of walk(root)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const item of unsafePatterns) {
      if (item.pattern.test(line)) {
        findings.push({
          file: relative(process.cwd(), file),
          label: item.label,
          line: index + 1,
          text: line.trim(),
        })
      }
    }
  })
}

if (findings.length === 0) {
  console.log("Server action audit passed: no raw throws found in action files.")
  process.exit(0)
}

console.log("Server action audit report")
console.log("==========================")
console.log(
  "These are candidates to convert into useActionState-friendly form errors."
)
console.log("")

for (const finding of findings) {
  console.log(
    `${finding.file}:${finding.line} [${finding.label}] ${finding.text}`
  )
}

console.log("")
console.log(
  `Found ${findings.length} raw throw candidate${
    findings.length === 1 ? "" : "s"
  }. This report is informational and does not fail CI yet.`
)
