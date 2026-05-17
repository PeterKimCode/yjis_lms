import "server-only"

import { DocumentStatus, DocumentType, FinalGradeStatus, UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import type { SessionRoleAssignment } from "@/modules/auth/auth"
import { canManageStudentData } from "@/modules/auth/permissions"

type DocumentAccess = {
  canPreviewDrafts: boolean
  userId: string
}

type GradeStatus = FinalGradeStatus

const publishedStatuses: GradeStatus[] = [
  FinalGradeStatus.PUBLISHED,
  FinalGradeStatus.FINALIZED,
]

export async function assertStudentDocumentAccess(input: {
  currentUserId: string
  roleAssignments: SessionRoleAssignment[]
  studentId: string
}) {
  const isAdmin = hasAdminRole(input.roleAssignments)

  if (isAdmin && (await canManageStudentData(input.currentUserId, input.studentId))) {
    return {
      canPreviewDrafts: true,
      userId: input.currentUserId,
    }
  }

  if (input.currentUserId === input.studentId) {
    return {
      canPreviewDrafts: false,
      userId: input.currentUserId,
    }
  }

  const parentRelation = await getPrismaClient().parentStudentRelation.findUnique({
    where: {
      parentId_studentId: {
        parentId: input.currentUserId,
        studentId: input.studentId,
      },
    },
    select: { id: true },
  })

  if (parentRelation) {
    return {
      canPreviewDrafts: false,
      userId: input.currentUserId,
    }
  }

  return null
}

export async function generateReportCardPdf(input: {
  access: DocumentAccess
  studentId: string
  termId?: string | null
}) {
  const prisma = getPrismaClient()
  const student = await prisma.user.findUnique({
    where: { id: input.studentId },
    include: {
      organization: true,
      studentProfile: {
        include: {
          campus: true,
          currentGradeLevel: true,
          homeroom: true,
        },
      },
      enrollments: {
        where: input.termId
          ? {
              classSection: {
                termId: input.termId,
              },
            }
          : undefined,
        include: {
          classSection: {
            include: {
              campus: true,
              course: true,
              term: true,
              instructors: {
                include: { instructor: true },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              },
              attendanceSessions: {
                include: {
                  records: {
                    where: { studentId: input.studentId },
                  },
                },
              },
              lessons: {
                where: { isPublished: true },
                include: {
                  videoProgress: {
                    where: { studentId: input.studentId },
                    take: 1,
                  },
                },
              },
              assignments: {
                include: {
                  submissions: {
                    where: { studentId: input.studentId },
                    take: 1,
                  },
                },
              },
              quizzes: {
                include: {
                  questions: { select: { points: true } },
                  attempts: {
                    where: { studentId: input.studentId },
                    orderBy: { createdAt: "desc" },
                  },
                },
              },
              finalGrades: {
                where: {
                  studentId: input.studentId,
                  ...(input.access.canPreviewDrafts
                    ? {}
                    : { status: { in: publishedStatuses } }),
                },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      },
    },
  })

  if (!student) {
    return null
  }

  const generatedAt = new Date()
  const termName =
    student.enrollments[0]?.classSection.term?.name ??
    (input.termId ? "Selected term" : "All terms")
  const rows = student.enrollments.map((enrollment) => {
    const section = enrollment.classSection
    const finalGrade = section.finalGrades[0]
    const attendance = getAttendanceRate(
      section.attendanceSessions.flatMap((session) => session.records)
    )
    const lessonCompletion = getLessonCompletion(section.lessons)
    const assignmentSummary = getAssignmentSummary(section.assignments)
    const quizSummary = getQuizSummary(section.quizzes)

    return {
      attendance,
      assignmentSummary,
      finalGrade,
      instructorNames: section.instructors
        .map((instructor) => instructor.instructor.name)
        .join(", "),
      lessonCompletion,
      quizSummary,
      section,
    }
  })

  const html = pageShell({
    title: "Report Card",
    body: `
      ${studentInfoHtml({ generatedAt, student, subtitle: termName })}
      <h2>Term Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
            <th>Attendance</th>
            <th>Lessons</th>
            <th>Assignments</th>
            <th>Quizzes</th>
            <th>Final Score</th>
            <th>Grade</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
              <tr>
                <td>${escapeHtml(row.section.course.title)}<br /><span>${escapeHtml(row.section.name)}</span></td>
                <td>${escapeHtml(row.instructorNames || "Unassigned")}</td>
                <td>${row.attendance.toFixed(1)}%</td>
                <td>${row.lessonCompletion}</td>
                <td>${row.assignmentSummary}</td>
                <td>${row.quizSummary}</td>
                <td>${formatGradeScore(row.finalGrade)}</td>
                <td>${escapeHtml(row.finalGrade?.letterGrade ?? "No final grade calculated")}</td>
                <td>${escapeHtml(row.finalGrade?.status ?? "-")}</td>
              </tr>
            `
                  )
                  .join("")
              : `<tr><td colspan="9">No enrolled class sections for this term.</td></tr>`
          }
        </tbody>
      </table>
      <p class="note">Student and parent downloads include published/finalized grades only. Administrative previews may include draft grades.</p>
    `,
  })

  const pdf = toArrayBuffer(await renderPdfFromHtml(html))

  await createGeneratedDocumentMetadata({
    documentType: DocumentType.REPORT_CARD,
    organizationId: student.organizationId,
    studentId: student.id,
  })

  return {
    filename: safePdfFilename(`report-card-${student.name}-${termName}`),
    pdf,
  }
}

export async function generateTranscriptPdf(input: {
  access: DocumentAccess
  studentId: string
}) {
  const prisma = getPrismaClient()
  const student = await prisma.user.findUnique({
    where: { id: input.studentId },
    include: {
      organization: true,
      studentProfile: {
        include: {
          campus: true,
          currentGradeLevel: true,
          homeroom: true,
        },
      },
      finalGrades: {
        where: input.access.canPreviewDrafts
          ? undefined
          : { status: { in: publishedStatuses } },
        include: {
          classSection: {
            include: {
              course: true,
              term: true,
              campus: true,
            },
          },
        },
        orderBy: [{ classSection: { term: { startsAt: "asc" } } }, { createdAt: "asc" }],
      },
    },
  })

  if (!student) {
    return null
  }

  const generatedAt = new Date()
  const terms = groupTranscriptGradesByTerm(student.finalGrades)
  const cumulative = calculateGpa(student.finalGrades)
  const html = pageShell({
    title: "Official Transcript",
    body: `
      ${studentInfoHtml({ generatedAt, student, subtitle: "University-style credit and GPA record" })}
      ${terms
        .map(
          (term) => `
            <h2>${escapeHtml(term.name)}</h2>
            <table>
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Credit</th>
                  <th>Letter</th>
                  <th>Grade Point</th>
                  <th>Earned Credit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${term.grades
                  .map(
                    (grade) => `
                      <tr>
                        <td>${escapeHtml(grade.classSection.course.code ?? "-")}</td>
                        <td>${escapeHtml(grade.classSection.course.title)}</td>
                        <td>${formatDecimal(grade.classSection.course.credits)}</td>
                        <td>${escapeHtml(grade.letterGrade ?? "-")}</td>
                        <td>${formatDecimal(grade.gradePoint)}</td>
                        <td>${formatDecimal(grade.creditsEarned)}</td>
                        <td>${escapeHtml(grade.status)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="summary">Term GPA: ${term.gpa.toFixed(2)} · Attempted credits: ${term.attempted.toFixed(1)} · Earned credits: ${term.earned.toFixed(1)}</div>
          `
        )
        .join("")}
      ${
        terms.length
          ? `<div class="summary total">Cumulative GPA: ${cumulative.gpa.toFixed(2)} · Attempted credits: ${cumulative.attempted.toFixed(1)} · Earned credits: ${cumulative.earned.toFixed(1)}</div>`
          : `<p>No transcript grades are available yet.</p>`
      }
    `,
  })

  const pdf = toArrayBuffer(await renderPdfFromHtml(html))

  await createGeneratedDocumentMetadata({
    documentType: DocumentType.TRANSCRIPT,
    organizationId: student.organizationId,
    studentId: student.id,
  })

  return {
    filename: safePdfFilename(`transcript-${student.name}`),
    pdf,
  }
}

function hasAdminRole(assignments: SessionRoleAssignment[]) {
  return assignments.some((assignment) =>
    ([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
      UserRole.SCHOOL_ADMIN,
      UserRole.ACADEMIC_STAFF,
    ] as UserRole[]).includes(assignment.role as UserRole)
  )
}

async function renderPdfFromHtml(html: string) {
  const { default: puppeteer } = await import("puppeteer")
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "domcontentloaded" })
    return page.pdf({
      format: "A4",
      margin: {
        bottom: "16mm",
        left: "12mm",
        right: "12mm",
        top: "16mm",
      },
      printBackground: true,
    })
  } finally {
    await browser.close()
  }
}

function pageShell({ body, title }: { body: string; title: string }) {
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { color: #111827; font-family: Arial, "Malgun Gothic", "Noto Sans KR", sans-serif; font-size: 12px; line-height: 1.45; }
          h1 { font-size: 24px; margin: 0 0 8px; }
          h2 { border-bottom: 1px solid #d1d5db; font-size: 16px; margin: 24px 0 10px; padding-bottom: 4px; }
          .meta { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; margin-top: 12px; padding: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
          .label { color: #6b7280; font-size: 10px; text-transform: uppercase; }
          .value { font-weight: 600; }
          table { border-collapse: collapse; margin-top: 8px; width: 100%; }
          th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
          td span, .note { color: #6b7280; font-size: 10px; }
          .summary { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin: 8px 0 18px; padding: 8px; }
          .total { font-size: 14px; font-weight: 700; }
          .footer { color: #6b7280; font-size: 10px; margin-top: 28px; }
        </style>
      </head>
      <body>${body}</body>
    </html>`
}

function studentInfoHtml({
  generatedAt,
  student,
  subtitle,
}: {
  generatedAt: Date
  student: {
    email: string | null
    name: string
    organization: { name: string }
    studentProfile: {
      campus: { name: string } | null
      currentGradeLevel: { name: string } | null
      homeroom: { name: string } | null
      studentNumber: string | null
    } | null
  }
  subtitle: string
}) {
  return `
    <h1>${escapeHtml(subtitle)}</h1>
    <div class="meta">
      <div class="grid">
        ${infoItem("School", student.organization.name)}
        ${infoItem("Campus", student.studentProfile?.campus?.name ?? "Organization-wide")}
        ${infoItem("Student", student.name)}
        ${infoItem("Email", student.email ?? "-")}
        ${infoItem("Student number", student.studentProfile?.studentNumber ?? "-")}
        ${infoItem("Grade / Homeroom", [
          student.studentProfile?.currentGradeLevel?.name,
          student.studentProfile?.homeroom?.name,
        ].filter(Boolean).join(" / ") || "-")}
        ${infoItem("Generated at", generatedAt.toLocaleString("en-US"))}
      </div>
    </div>
  `
}

function infoItem(label: string, value: string) {
  return `<div><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`
}

function getAttendanceRate(records: Array<{ status: string }>) {
  const counted = records.filter((record) => record.status !== "PENDING")
  if (!counted.length) return 0

  const points = counted.reduce((sum, record) => {
    if (record.status === "PRESENT") return sum + 1
    if (record.status === "LATE") return sum + 0.5
    if (
      record.status === "EXCUSED" ||
      record.status === "SICK_LEAVE" ||
      record.status === "OFFICIAL_ABSENCE"
    ) {
      return sum + 1
    }
    if (record.status === "EARLY_LEAVE") return sum + 0.75
    return sum
  }, 0)

  return (points / counted.length) * 100
}

function getLessonCompletion(
  lessons: Array<{ videoProgress: Array<{ completed: boolean }> }>
) {
  if (!lessons.length) return "0/0"
  const completed = lessons.filter((lesson) => lesson.videoProgress[0]?.completed).length
  return `${completed}/${lessons.length}`
}

function getAssignmentSummary(
  assignments: Array<{
    pointsPossible: { toString(): string } | null
    submissions: Array<{ score: { toString(): string } | null }>
  }>
) {
  if (!assignments.length) return "0/0"

  const submitted = assignments.filter((assignment) => assignment.submissions[0]).length
  const earned = assignments.reduce(
    (sum, assignment) => sum + Number(assignment.submissions[0]?.score ?? 0),
    0
  )
  const possible = assignments.reduce(
    (sum, assignment) => sum + Number(assignment.pointsPossible ?? 0),
    0
  )

  return possible ? `${earned.toFixed(1)}/${possible.toFixed(1)}` : `${submitted}/${assignments.length}`
}

function getQuizSummary(
  quizzes: Array<{
    attempts: Array<{ score: { toString(): string } | null; submittedAt: Date | null }>
    pointsPossible: { toString(): string } | null
    questions: Array<{ points: { toString(): string } }>
  }>
) {
  if (!quizzes.length) return "0/0"

  const earned = quizzes.reduce((sum, quiz) => {
    const best = quiz.attempts
      .filter((attempt) => attempt.submittedAt)
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))[0]
    return sum + Number(best?.score ?? 0)
  }, 0)
  const possible = quizzes.reduce((sum, quiz) => {
    if (quiz.pointsPossible) return sum + Number(quiz.pointsPossible)
    return (
      sum +
      quiz.questions.reduce((questionSum, question) => questionSum + Number(question.points), 0)
    )
  }, 0)

  return possible ? `${earned.toFixed(1)}/${possible.toFixed(1)}` : `0/${quizzes.length}`
}

function formatGradeScore(
  grade?: {
    numericScore: { toString(): string } | null
    percentage: { toString(): string } | null
  } | null
) {
  if (!grade) return "No final grade calculated"
  if (grade.percentage) return `${formatDecimal(grade.percentage)}%`
  if (grade.numericScore) return formatDecimal(grade.numericScore)
  return "-"
}

function groupTranscriptGradesByTerm<
  T extends {
    classSection: {
      course: { credits: { toString(): string } | null }
      term: { id: string; name: string } | null
    }
    creditsEarned: { toString(): string } | null
    gradePoint: { toString(): string } | null
  },
>(grades: T[]) {
  const grouped = new Map<string, { grades: T[]; name: string }>()

  for (const grade of grades) {
    const key = grade.classSection.term?.id ?? "no-term"
    const name = grade.classSection.term?.name ?? "No term"
    const group = grouped.get(key) ?? { grades: [], name }
    group.grades.push(grade)
    grouped.set(key, group)
  }

  return [...grouped.values()].map((group) => ({
    ...group,
    ...calculateGpa(group.grades),
  }))
}

function calculateGpa(
  grades: Array<{
    classSection: { course: { credits: { toString(): string } | null } }
    creditsEarned: { toString(): string } | null
    gradePoint: { toString(): string } | null
  }>
) {
  const attempted = grades.reduce(
    (sum, grade) => sum + Number(grade.classSection.course.credits ?? 0),
    0
  )
  const earned = grades.reduce((sum, grade) => sum + Number(grade.creditsEarned ?? 0), 0)
  const weightedPoints = grades.reduce(
    (sum, grade) =>
      sum +
      Number(grade.classSection.course.credits ?? 0) * Number(grade.gradePoint ?? 0),
    0
  )

  return {
    attempted,
    earned,
    gpa: attempted ? weightedPoints / attempted : 0,
  }
}

async function createGeneratedDocumentMetadata(input: {
  documentType: DocumentType
  organizationId: string
  studentId: string
}) {
  await getPrismaClient().generatedDocument.create({
    data: {
      documentType: input.documentType,
      generatedAt: new Date(),
      organizationId: input.organizationId,
      status: DocumentStatus.GENERATED,
      studentId: input.studentId,
    },
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function safePdfFilename(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 120)

  return `${normalized || "document"}.pdf`
}

function formatDecimal(value: { toString(): string } | null | undefined) {
  if (!value) return "-"

  const numberValue = Number(value)

  if (Number.isFinite(numberValue)) {
    return Number.isInteger(numberValue)
      ? numberValue.toString()
      : numberValue.toFixed(2)
  }

  return value.toString()
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}
