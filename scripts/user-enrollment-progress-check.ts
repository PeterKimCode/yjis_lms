// Run only against the disposable, migrated and seeded enrollment-progress QA database.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { getPrismaClient } from "../src/lib/prisma"

const base = "http://localhost:3034"
if (process.env.DATABASE_URL !== "postgresql://lms_qa:lms_progress_qa@127.0.0.1:15550/lms_progress_qa") {
  throw new Error("Only the disposable enrollment-progress QA database is allowed.")
}
const db = getPrismaClient()
class Client {
  cookies = new Map<string, string>()
  async request(path: string, init: RequestInit = {}) {
    const response = await fetch(new URL(path, base), { ...init, redirect: "manual", headers: {
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...init.headers,
    } })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0], index = pair.indexOf("=")
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    return response
  }
  async html(path: string) {
    const response = await this.request(path)
    assert.equal(response.status, 200, path)
    return (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  }
  async login(email: string) {
    const csrf = await (await this.request("/api/auth/csrf")).json()
    await this.request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password: "DemoPass123!", csrfToken: csrf.csrfToken, callbackUrl: "/login/redirect", json: "true" }),
    })
    assert.ok((await (await this.request("/api/auth/session")).json()).user?.id, email)
  }
  async query(input: unknown) {
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"))
    const entry = Object.entries(manifest.node).find(([, value]) => (value as { exportedName: string }).exportedName === "loadUserEnrollmentPage")
    assert.ok(entry, "Compiled enrollment query exists")
    const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-webpack/client.node")
    const response = await this.request("/admin/users", { method: "POST", body: await encodeReply([input]), headers: { origin: base, "next-action": entry[0] } })
    return { status: response.status, text: await response.text() }
  }
}

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/<!--.*?-->/g, "").trim()
async function main() {
  const student = await db.user.findFirstOrThrow({ where: { email: "student@demo.local" } })
  const seed = await db.classSection.findFirstOrThrow({ where: { organizationId: student.organizationId } })
  const other = await db.user.create({ data: { organizationId: student.organizationId, name: "Other QA Student" } })
  const context = { organizationId: student.organizationId, campusId: seed.campusId }
  const enrolled = { create: { ...context, studentId: student.id, status: "ENROLLED" as const } }
  const fixture = await db.classSection.create({ data: { ...context, academicYearId: seed.academicYearId, courseId: seed.courseId, name: "Progress QA main", enrollments: enrolled } })
  for (let i = 0; i < 5; i++) {
    const lesson = await db.lesson.create({ data: { organizationId: student.organizationId, classSectionId: fixture.id, title: `QA lesson ${i}`, isPublished: i < 4 } })
    if (i !== 3) await db.videoProgress.create({ data: { organizationId: student.organizationId, lessonId: lesson.id, studentId: student.id, completed: true } })
    if (i === 0) await db.videoProgress.create({ data: { organizationId: student.organizationId, lessonId: lesson.id, studentId: student.id, completed: true } })
    if (i === 3) await db.videoProgress.create({ data: { organizationId: student.organizationId, lessonId: lesson.id, studentId: other.id, completed: true } })
  }
  await db.classSection.create({ data: { ...context, academicYearId: seed.academicYearId, courseId: seed.courseId, name: "Progress QA no lessons", enrollments: enrolled } })
  await db.classSection.create({ data: { ...context, academicYearId: seed.academicYearId, courseId: seed.courseId, name: "Progress QA not enrolled" } })
  const zero = await db.classSection.create({ data: { ...context, academicYearId: seed.academicYearId, courseId: seed.courseId, name: "Progress QA not started", enrollments: enrolled } })
  await db.lesson.create({ data: { organizationId: student.organizationId, classSectionId: zero.id, title: "Not started", isPublished: true } })
  for (const email of ["super.admin@demo.local", "school.admin@demo.local"]) {
    const client = new Client()
    await client.login(email)
    const html = await client.html(`/admin/users/${student.id}`)
    const table = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].find(m => m[0].includes("Select for enrollment"))?.[0]
    assert.ok(table, "Enrollment table exists")
    const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m => text(m[1]))
    assert.equal(headers[0], "Status")
    assert.equal(headers[4], "Lesson completion")
    assert.equal(headers[6], "Select for enrollment")
    function row(name: string) {
      const tr = [...table!.matchAll(/<tr\b[\s\S]*?<\/tr>/g)].find(m => m[0].includes(name))?.[0]
      assert.ok(tr, name)
      return [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m => text(m[1]))
    }
    assert.equal(row("Progress QA main")[4], "3/4", "Exclude drafts, other students, and duplicate progress rows")
    assert.equal(row("Progress QA main")[0], "ENROLLED")
    assert.equal(row("Progress QA main")[6], "—", "No misleading selection toggle for enrolled rows")
    assert.equal(row("Progress QA no lessons")[4], "0/0")
    assert.equal(row("Progress QA not started")[4], "0/1")
    assert.equal(row("Progress QA not enrolled")[4], "—")
    const response = await client.query({ userId: student.id, page: 1, q: "Progress QA main", tab: "Enrolled", sectionId: "" })
    assert.equal(response.status, 200)
    assert.ok(response.text.includes('"completedLessonCount":3'))
    assert.ok(response.text.includes('"lessonCount":4'))
  }
  console.log("PASS: Super Admin and School Admin see 3/4; drafts, duplicate rows and other students excluded; 0/0 and not-started states; status first; enrollment selection last; filtering preserves counts.")
}
main().finally(() => db.$disconnect())
