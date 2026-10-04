import { existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

// Documentation-only generator. It never connects to the LMS database.
const bundledPython = path.join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe")
const python = process.env.LMS_MANUAL_PYTHON || (process.platform === "win32" && existsSync(bundledPython) ? bundledPython : process.platform === "win32" ? "python" : "python3")
const script = path.resolve("docs/manuals/source/build_manuals.py")
const result = spawnSync(python, [script, ...process.argv.slice(2)], { stdio: "inherit" })
if (result.error) {
  console.error("Could not run the manual generator. Set LMS_MANUAL_PYTHON to a Python executable; see docs/manuals/README.md.")
  console.error(result.error.message)
}
process.exit(result.status ?? 1)
