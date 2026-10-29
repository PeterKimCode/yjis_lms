// Run only against the disposable, migrated and seeded login-visibility QA database.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { getPrismaClient } from "../src/lib/prisma"

const base = "http://localhost:3033"
if (process.env.DATABASE_URL !== "postgresql://lms_qa:lms_visibility_qa@127.0.0.1:15549/lms_visibility_qa") {
  throw new Error("Only the disposable login-visibility QA database is allowed.")
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
  async visibility(id: string, visible: unknown) {
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"))
    const entry = Object.entries(manifest.node).find(([, value]) => (value as { exportedName: string }).exportedName === "setOrganizationLoginVisibility")
    assert.ok(entry, "Compiled visibility action exists")
    const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-webpack/client.node")
    const response = await this.request("/admin/login-notices", { method: "POST", body: await encodeReply([id, visible]), headers: { origin: base, "next-action": entry[0] } })
    return { status: response.status, text: await response.text() }
  }
}

async function main() {
  const org = await db.organization.create({ data: { slug: `visibility-qa-${Date.now()}`, name: "Login Visibility QA School", institutionType: "ONLINE_SCHOOL" } })
  assert.equal(org.showOnLogin, true, "Existing behavior remains visible by default")
  const notice = await db.loginNotice.create({ data: { organizationId: org.id, title: "Visibility QA public notice", body: "QA notice body", isPublished: true } })
  const anon = new Client(), superAdmin = new Client(), school = new Client()
  await superAdmin.login("super.admin@demo.local")
  await school.login("school.admin@demo.local")
  const superHtml = await superAdmin.html(`/admin/login-notices?organization=${org.id}`)
  assert.ok(superHtml.includes("Show organization on login page"))
  assert.ok(!superHtml.includes('name="startsAt"') && !superHtml.includes('name="endsAt"'))
  assert.ok(!(await school.html("/admin/login-notices")).includes("Show organization on login page"))
  assert.ok((await anon.html("/login")).includes(org.name))
  assert.ok((await anon.html("/login")).includes(notice.title))
  const auditCount = () => db.auditLog.count({ where: { entityId: org.id, action: "organization.login_visibility.update" } })
  assert.equal((await superAdmin.visibility(org.id, "false")).status, 200)
  assert.equal((await db.organization.findUniqueOrThrow({ where: { id: org.id } })).showOnLogin, true, "Non-boolean payload rejected")
  assert.equal(await auditCount(), 0)
  const rejected = await school.visibility(org.id, false)
  assert.notEqual(rejected.status, 200, "Forged School Admin action rejected")
  assert.equal((await db.organization.findUniqueOrThrow({ where: { id: org.id } })).showOnLogin, true)
  assert.equal((await superAdmin.visibility(org.id, false)).status, 200)
  assert.equal((await db.organization.findUniqueOrThrow({ where: { id: org.id } })).showOnLogin, false)
  assert.equal(await auditCount(), 1)
  for (const path of ["/login", `/login?organization=${org.slug}`, `/login?notice=${notice.id}`, `/login?organization=${org.slug}&notice=${notice.id}`]) {
    const html = await anon.html(path)
    assert.ok(!html.includes(org.name) && !html.includes(notice.title), `Hidden organization or notice leaked: ${path}`)
  }
  assert.equal((await anon.request(`/api/public/organizations/${org.id}/logo`)).status, 404)
  const student = await db.user.findFirstOrThrow({ where: { email: "student@demo.local" } })
  const hiddenUser = await db.user.create({ data: {
    organizationId: org.id, email: "hidden.organization@demo.local", name: "Visibility QA Student", passwordHash: student.passwordHash,
    roleAssignments: { create: { organizationId: org.id, role: "STUDENT" } },
  } })
  assert.ok(hiddenUser.email)
  await new Client().login(hiddenUser.email)
  assert.equal((await superAdmin.visibility(org.id, true)).status, 200)
  assert.ok((await anon.html(`/login?organization=${org.slug}`)).includes(notice.title), "Re-enable restores public notices")
  assert.equal(await auditCount(), 2)
  await db.organization.update({ where: { id: org.id }, data: { isActive: false } })
  assert.ok(!(await anon.html("/login")).includes(org.name), "Inactive organizations stay excluded")
  console.log("PASS: default visibility; Super Admin toggle; School Admin forged action denied; invalid payload; public/direct-link hiding; hidden account login; re-enable; inactive exclusion; audit log.")
}
main().finally(() => db.$disconnect())
