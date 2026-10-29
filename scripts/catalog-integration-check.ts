// Requires the isolated demo database, migrated and seeded, and a local Next server.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { CreateBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getPrismaClient } from "../src/lib/prisma"
const base = process.env.TEST_BASE_URL ?? "http://localhost:3028"
if (new URL(base).hostname !== "localhost" || !process.env.DATABASE_URL?.includes("127.0.0.1:5548/lms_demo")) throw new Error("Only the isolated catalog demo environment is allowed.")
const db = getPrismaClient()
function decode(s: string) { return s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") }
class Client {
  cookies = new Map<string, string>()
  async fetch(path: string, init: RequestInit = {}) {
    const response = await fetch(new URL(path, base), { ...init, redirect: "manual", headers: { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...init.headers } })
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], i = pair.indexOf("="); this.cookies.set(pair.slice(0, i), pair.slice(i + 1)) }
    return response
  }
  async login(email: string) {
    const csrf = await (await this.fetch("/api/auth/csrf")).json()
    await this.fetch("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, password: "DemoPass123!", csrfToken: csrf.csrfToken, callbackUrl: "/login/redirect", json: "true" }) })
    const session = await (await this.fetch("/api/auth/session")).json()
    assert.ok(session.user?.id, `Login failed: ${email}`)
    return session.user.id as string
  }
  async html(path: string) { const r = await this.fetch(path); return { status: r.status, html: await r.text(), location: r.headers.get("location") } }
  async rpc(path: string, exportedName: string, args: unknown[]) {
    const manifest = JSON.parse(await readFile(".next/dev/server/server-reference-manifest.json", "utf8"))
    const entry = Object.entries(manifest.node).find(([, value]) => (value as { exportedName: string }).exportedName === exportedName)
    assert.ok(entry, `Missing compiled test action: ${exportedName}`)
    const { encodeReply } = createRequire(import.meta.url)("next/dist/compiled/react-server-dom-webpack/client.node")
    const response = await this.fetch(path, { method: "POST", body: await encodeReply(args), headers: { origin: base, "next-action": entry[0] } })
    return { status: response.status, body: await response.text() }
  }
  async submit(path: string, contains: string, values: Record<string, string>) {
    const { html } = await this.html(path)
    const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].find(m => m[0].includes(contains))?.[0]
    assert.ok(form, `Form not found: ${path} / ${contains}`)
    const data = new FormData()
    for (const input of form.matchAll(/<input\b[^>]*>/g)) {
      const attrs = Object.fromEntries([...input[0].matchAll(/([\w:$-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]))
      if (attrs.type === "hidden" && attrs.name) data.append(attrs.name, attrs.value ?? "")
    }
    assert.ok([...data.keys()].some(k => k.startsWith("$ACTION_")), "Missing server action reference")
    for (const [key, value] of Object.entries(values)) data.set(key, value)
    const response = await this.fetch(path, { method: "POST", body: data, headers: { origin: base } })
    const body = await response.text()
    assert.ok(response.status < 500, `Action failed (${response.status}): ${body.slice(-300)}`)
  }
}
async function main() {
  const student = await db.user.findFirstOrThrow({ where: { email: "student@demo.local" } })
  const instructor = await db.user.findFirstOrThrow({ where: { email: "instructor@demo.local" } })
  const source = await db.classSection.findFirstOrThrow({ where: { organizationId: student.organizationId } })
  const organization = await db.organization.upsert({ where: { slug: "catalog-demo-host" }, create: { name: "Global Learning School", slug: "catalog-demo-host", institutionType: "ONLINE_SCHOOL", timezone: "America/New_York" }, update: {} })
  const s3 = new S3Client({ endpoint: "http://127.0.0.1:9048", region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: "catalog_demo", secretAccessKey: "catalog_minio_demo_only" } })
  try { await s3.send(new CreateBucketCommand({ Bucket: "catalog-demo" })) } catch (e) { if ((e as { name: string }).name !== "BucketAlreadyOwnedByYou") throw e }
  await s3.send(new PutObjectCommand({ Bucket: "catalog-demo", Key: "logo.png", Body: await readFile("public/brand/gtcc-logo.png"), ContentType: "image/png" }))
  await s3.send(new PutObjectCommand({ Bucket: "catalog-demo", Key: "course.png", Body: await readFile("public/brand/gtcc-logo.png"), ContentType: "image/png" }))
  const logo = await db.fileAsset.upsert({ where: { id: "catalog-demo-logo" }, create: { id: "catalog-demo-logo", organizationId: organization.id, uploadedById: student.id, bucket: "catalog-demo", objectKey: "logo.png", originalName: "logo.png", contentType: "image/png", byteSize: 1000 }, update: {} })
  await db.organization.update({ where: { id: organization.id }, data: { logoFileAssetId: logo.id } })
  const year = await db.academicYear.upsert({ where: { id: "catalog-demo-year" }, create: { id: "catalog-demo-year", organizationId: organization.id, name: "2026", startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01") }, update: {} })
  const course = await db.course.upsert({ where: { id: "catalog-demo-course" }, create: { id: "catalog-demo-course", organizationId: organization.id, title: "Shared learning" }, update: {} })
  for (const [id, name, isRecruiting, capacity] of [["catalog-demo-class", "World Literature", true, 1], ["catalog-demo-hidden", "Hidden class", false, 5], ["catalog-demo-full", "Full class", true, 0], ["catalog-demo-cancel", "Application practice", true, 5]] as const) {
    await db.classSection.upsert({ where: { id }, create: { id, name, organizationId: organization.id, academicYearId: year.id, courseId: course.id, isRecruiting, capacity, catalogDescription: "Read and discuss stories with students from our partner schools." }, update: { isRecruiting, capacity } })
  }
  const school = await db.user.upsert({ where: { id: "catalog-demo-admin" }, create: { id: "catalog-demo-admin", organizationId: organization.id, name: "Host School Admin", email: "host.admin@demo.local", passwordHash: student.passwordHash }, update: {} })
  await db.userRoleAssignment.deleteMany({ where: { userId: school.id } })
  await db.userRoleAssignment.create({ data: { userId: school.id, organizationId: organization.id, role: "SCHOOL_ADMIN" } })
  const second = await db.user.upsert({ where: { id: "catalog-demo-student2" }, create: { id: "catalog-demo-student2", organizationId: student.organizationId, name: "Second Demo Student", email: "second.student@demo.local", passwordHash: student.passwordHash }, update: {} })
  if (!await db.userRoleAssignment.count({ where: { userId: second.id, role: "STUDENT" } })) await db.userRoleAssignment.create({ data: { userId: second.id, organizationId: student.organizationId, role: "STUDENT" } })
  const staff = await db.user.upsert({ where: { id: "catalog-demo-staff" }, create: { id: "catalog-demo-staff", organizationId: student.organizationId, name: "Demo Academic Staff", email: "academic.staff@demo.local", passwordHash: student.passwordHash }, update: {} })
  if (!await db.userRoleAssignment.count({ where: { userId: staff.id, role: "ACADEMIC_STAFF" } })) await db.userRoleAssignment.create({ data: { userId: staff.id, organizationId: student.organizationId, role: "ACADEMIC_STAFF" } })
  await db.classSectionInstructor.upsert({ where: { classSectionId_instructorId: { classSectionId: "catalog-demo-class", instructorId: instructor.id } }, create: { organizationId: organization.id, classSectionId: "catalog-demo-class", instructorId: instructor.id }, update: {} })
  await db.lesson.upsert({ where: { id: "catalog-demo-lesson" }, create: { id: "catalog-demo-lesson", classSectionId: "catalog-demo-class", organizationId: organization.id, title: "Welcome to world literature", description: "Public lesson after approval", isPublished: true }, update: {} })
  await db.assignment.upsert({ where: { id: "catalog-demo-assignment" }, create: { id: "catalog-demo-assignment", organizationId: organization.id, classSectionId: "catalog-demo-class", title: "Reading response" }, update: {} })
  await db.quiz.upsert({ where: { id: "catalog-demo-quiz" }, create: { id: "catalog-demo-quiz", organizationId: organization.id, classSectionId: "catalog-demo-class", title: "Reading quiz", isPublished: true, questions: { create: { id: "catalog-demo-question", organizationId: organization.id, type: "ESSAY", prompt: "Describe the story.", points: 10, sequence: 1 } } }, update: {} })
  await db.assignmentSubmission.deleteMany({ where: { assignmentId: "catalog-demo-assignment" } })
  await db.quizAttempt.deleteMany({ where: { quizId: "catalog-demo-quiz" } })
  await db.conversation.upsert({ where: { id: "catalog-demo-conversation" }, create: { id: "catalog-demo-conversation", organizationId: organization.id, classSectionId: "catalog-demo-class", type: "CLASS_SECTION", title: "World Literature conversation" }, update: {} })
  await db.conversationParticipant.deleteMany({ where: { conversationId: "catalog-demo-conversation" } })
  for (const [id, scopeType, classSectionId] of [["catalog-demo-class-board", "CLASS_SECTION", "catalog-demo-class"], ["catalog-demo-private-board", "ORGANIZATION", null]] as const) await db.board.upsert({ where: { id }, create: { id, organizationId: organization.id, classSectionId, scopeType, type: "NOTICE", name: id }, update: {} })
  await db.fileAsset.upsert({ where: { id: "catalog-demo-private-file" }, create: { id: "catalog-demo-private-file", organizationId: organization.id, classSectionId: "catalog-demo-class", uploadedById: instructor.id, bucket: "catalog-demo", objectKey: "course.png", originalName: "course-resource.png", contentType: "image/png", byteSize: 1000 }, update: {} })
  await db.classSection.update({ where: { id: source.id }, data: { isRecruiting: true } })
  for (const [id, title, isPublished, startsAt, endsAt] of [["catalog-notice-public", "Welcome to our learning community", true, null, null], ["catalog-notice-private", "PRIVATE-NOTICE-MUST-NOT-LEAK", false, null, null], ["catalog-notice-future", "FUTURE-NOTICE-MUST-NOT-LEAK", true, new Date("2099-01-01"), null], ["catalog-notice-expired", "EXPIRED-NOTICE-MUST-NOT-LEAK", true, null, new Date("2000-01-01")]] as const) await db.loginNotice.upsert({ where: { id }, create: { id, organizationId: organization.id, title, body: "School news for our community.", isPublished, startsAt, endsAt }, update: {} })
  await db.enrollment.deleteMany({ where: { classSectionId: { startsWith: "catalog-demo-" } } })
  await db.enrollmentRequest.deleteMany({ where: { OR: [{ classSectionId: { startsWith: "catalog-demo-" } }, { studentId: second.id }] } })
  const anonymous = new Client(), learner = new Client(), other = new Client(), admin = new Client(), sourceAdmin = new Client(), teacher = new Client(), parent = new Client(), superAdmin = new Client(), academic = new Client()
  const login = (await anonymous.html("/login")).html
  assert.ok(login.includes("Welcome to our learning community"))
  for (const forbidden of ["PRIVATE-NOTICE-MUST-NOT-LEAK", "FUTURE-NOTICE-MUST-NOT-LEAK", "EXPIRED-NOTICE-MUST-NOT-LEAK"]) assert.ok(!login.includes(forbidden))
  assert.ok(!(await anonymous.html("/login?organization=demo-education-organization")).html.includes("Welcome to our learning community"))
  assert.equal((await anonymous.fetch("/api/files/catalog-private-file/download")).status, 401)
  assert.equal((await anonymous.fetch(`/api/public/organizations/${organization.id}/logo`)).status, 200)
  assert.equal((await anonymous.fetch("/api/public/organizations/missing/logo")).status, 404)
  console.log("PASS public notice scheduling/filtering and private file authentication")
  await learner.login("student@demo.local"); await other.login("second.student@demo.local"); await admin.login("host.admin@demo.local"); await sourceAdmin.login("school.admin@demo.local"); await teacher.login("instructor@demo.local"); await parent.login("parent@demo.local"); await superAdmin.login("super.admin@demo.local"); await academic.login("academic.staff@demo.local")
  for (const [client, path] of [[learner, "/student"], [admin, "/admin/users"], [teacher, "/instructor"], [parent, "/parent"], [superAdmin, "/admin"], [academic, "/admin"]] as const) assert.equal((await client.html(path)).status, 200)
  const noticeValues = { title: "Scheduled demo notice", body: "Demo public information", startsAt: "2030-07-01T09:00", endsAt: "2030-07-01T10:00", isPublished: "on" }
  await admin.submit("/admin/login-notices", `value="${organization.id}"`, noticeValues)
  assert.equal((await db.loginNotice.findFirstOrThrow({ where: { title: noticeValues.title }, orderBy: { createdAt: "desc" } })).startsAt?.toISOString(), "2030-07-01T13:00:00.000Z")
  await sourceAdmin.submit("/admin/login-notices", `value="${student.organizationId}"`, { ...noticeValues, organizationId: organization.id, title: "FORGED NOTICE MUST NOT EXIST" })
  assert.equal(await db.loginNotice.count({ where: { title: "FORGED NOTICE MUST NOT EXIST" } }), 0)
  const catalog = "/student/catalog", detail = "/student/classes/catalog-demo-class", requests = "/admin/enrollment-requests"
  const list = (await learner.html(catalog)).html
  assert.ok(list.includes("World Literature")); assert.ok(!list.includes("Hidden class"))
  assert.ok(!(await learner.html(detail)).html.includes("Welcome to world literature"))
  assert.equal((await learner.fetch("/api/files/catalog-demo-private-file/download")).status, 403)
  await learner.submit(catalog, 'value="catalog-demo-class"', {})
  const request = await db.enrollmentRequest.findUniqueOrThrow({ where: { classSectionId_studentId: { classSectionId: "catalog-demo-class", studentId: student.id } } })
  assert.equal(request.status, "PENDING")
  assert.equal(await db.enrollment.count({ where: { classSectionId: "catalog-demo-class" } }), 0)
  assert.ok(!(await learner.html(detail)).html.includes("Welcome to world literature"))
  assert.ok(!(await sourceAdmin.html(requests)).html.includes(request.id))
  for (const client of [academic, teacher]) assert.ok(!(await client.html(requests)).html.includes("Reason (required to reject)"))
  await other.submit(catalog, `value="${source.id}"`, {})
  const localRequest = await db.enrollmentRequest.findUniqueOrThrow({ where: { classSectionId_studentId: { classSectionId: source.id, studentId: second.id } } })
  await sourceAdmin.submit(requests, `value="${localRequest.id}"`, { requestId: request.id, decision: "APPROVED" })
  assert.equal((await db.enrollmentRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PENDING")
  console.log("PASS six role pages, hidden catalog, pending access and forged cross-school approval rejection")
  await other.submit(catalog, 'value="catalog-demo-class"', {})
  const otherRequest = await db.enrollmentRequest.findUniqueOrThrow({ where: { classSectionId_studentId: { classSectionId: "catalog-demo-class", studentId: second.id } } })
  await Promise.all([admin.submit(requests, `value="${request.id}"`, { decision: "APPROVED" }), admin.submit(requests, `value="${otherRequest.id}"`, { decision: "APPROVED" })])
  assert.equal(await db.enrollment.count({ where: { classSectionId: "catalog-demo-class", status: "ENROLLED" } }), 1)
  const approved = await db.enrollmentRequest.findFirstOrThrow({ where: { classSectionId: "catalog-demo-class", status: "APPROVED" } })
  const winner = approved.studentId === student.id ? learner : other
  assert.ok((await winner.html(detail)).html.includes("Welcome to world literature"))
  assert.equal((await winner.fetch("/api/files/catalog-demo-private-file/download")).status, 200)
  const winnerId = approved.studentId
  const parentUser = await db.user.findFirstOrThrow({ where: { email: "parent@demo.local" } })
  await db.parentStudentRelation.upsert({ where: { parentId_studentId: { parentId: parentUser.id, studentId: winnerId } }, create: { relation: "Guardian", organizationId: student.organizationId, parentId: parentUser.id, studentId: winnerId }, update: {} })
  assert.ok((await parent.html(`/parent/students/${winnerId}/classes/catalog-demo-class`)).html.includes("World Literature"))
  assert.ok((await winner.html(`${detail}/lessons/catalog-demo-lesson`)).html.includes("Public lesson after approval"))
  assert.ok((await winner.html(`${detail}/boards/catalog-demo-class-board`)).html.includes("catalog-demo-class-board"))
  assert.ok(!(await winner.html(`${detail}/boards/catalog-demo-private-board`)).html.includes("Create post"))
  const response = new FormData(); response.set("assignmentId", "catalog-demo-assignment"); response.set("content", "A visiting student's reading response.")
  assert.equal((await winner.rpc(`${detail}?tab=assessments&view=assignments`, "submitAssignment", [{ ok: false, message: "" }, response])).status, 200)
  assert.equal(await db.assignmentSubmission.count({ where: { assignmentId: "catalog-demo-assignment", studentId: winnerId } }), 1)
  const answers = new FormData(); answers.set("quizId", "catalog-demo-quiz"); answers.set("answer_catalog-demo-question", "The story explores friendship.")
  assert.equal((await winner.rpc(`${detail}?tab=assessments&view=quizzes`, "submitQuiz", [{ ok: false, message: "" }, answers])).status, 200)
  assert.equal(await db.quizAttempt.count({ where: { quizId: "catalog-demo-quiz", studentId: winnerId } }), 1)
  const conversation = new FormData(); conversation.set("classSectionId", "catalog-demo-class")
  await winner.rpc(detail, "openClassConversation", [conversation])
  assert.equal(await db.conversationParticipant.count({ where: { conversationId: "catalog-demo-conversation", userId: winnerId } }), 1)
  assert.ok((await winner.html("/messages/catalog-demo-conversation")).html.includes("World Literature conversation"))
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: student.id } })).organizationId, student.organizationId)
  console.log("PASS concurrent approvals respect capacity and home organization remains unchanged")
  await learner.submit(catalog, 'value="catalog-demo-cancel"', {})
  const cancellable = await db.enrollmentRequest.findUniqueOrThrow({ where: { classSectionId_studentId: { classSectionId: "catalog-demo-cancel", studentId: student.id } } })
  await learner.submit(catalog, `value="${cancellable.id}"`, {})
  assert.equal((await db.enrollmentRequest.findUniqueOrThrow({ where: { id: cancellable.id } })).status, "CANCELLED")
  await learner.submit(catalog, 'value="catalog-demo-cancel"', {})
  await admin.submit(requests, `value="${cancellable.id}"`, { decision: "REJECTED", reason: "Please choose the next term." })
  assert.equal((await db.enrollmentRequest.findUniqueOrThrow({ where: { id: cancellable.id } })).status, "REJECTED")
  assert.ok((await learner.html(`${catalog}?status=REJECTED`)).html.includes("Please choose the next term."))
  await learner.submit(catalog, 'value="catalog-demo-cancel"', {})
  assert.equal((await db.enrollmentRequest.findUniqueOrThrow({ where: { id: cancellable.id } })).status, "PENDING")
  assert.ok(await db.notification.count({ where: { userId: student.id, type: "SYSTEM_NOTICE" } }) > 0)
  console.log("PASS cancellation, rejection reason, resubmission, notification and audit persistence")
}
main().finally(() => db.$disconnect()).catch(e => { console.error(e); process.exitCode = 1 })
