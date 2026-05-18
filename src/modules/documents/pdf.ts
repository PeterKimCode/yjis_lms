import "server-only"

import { DocumentStatus, DocumentType, FinalGradeStatus, UserRole } from "@prisma/client"
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib"

import { getPrismaClient } from "@/lib/prisma"
import type { SessionRoleAssignment } from "@/modules/auth/auth"
import { canManageStudentData } from "@/modules/auth/permissions"

type DocumentAccess = {
  canPreviewDrafts: boolean
  userId: string
}

type PdfFonts = {
  bold: PDFFont
  regular: PDFFont
}

type PdfContext = {
  doc: PDFDocument
  fonts: PdfFonts
  page: PDFPage
  y: number
}

type TableColumn<T> = {
  header: string
  value: (row: T) => string
  width: number
}

type GradeStatus = FinalGradeStatus

const publishedStatuses: GradeStatus[] = [
  FinalGradeStatus.PUBLISHED,
  FinalGradeStatus.FINALIZED,
]

const pageSize: [number, number] = [595.28, 841.89]
const margin = 42
const rowLineHeight = 11
const textColor = rgb(0.08, 0.1, 0.16)
const mutedColor = rgb(0.38, 0.42, 0.5)
const borderColor = rgb(0.82, 0.85, 0.9)
const headerFill = rgb(0.95, 0.96, 0.98)

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

    return {
      assignments: getAssignmentSummary(section.assignments),
      attendance: `${getAttendanceRate(
        section.attendanceSessions.flatMap((session) => session.records)
      ).toFixed(1)}%`,
      course: `${section.course.title} / ${section.name}`,
      finalScore: formatGradeScore(finalGrade),
      gradePoint: formatDecimal(finalGrade?.gradePoint),
      instructor: section.instructors
        .map((instructor) => instructor.instructor.name)
        .join(", ") || "Unassigned",
      letter: finalGrade?.letterGrade ?? "No final grade calculated",
      lessons: getLessonCompletion(section.lessons),
      quizzes: getQuizSummary(section.quizzes),
      status: finalGrade?.status ?? "-",
    }
  })

  const ctx = await createPdfContext()
  drawDocumentHeader(ctx, "Report Card", termName)
  drawStudentInfo(ctx, student, generatedAt)
  drawSectionHeading(ctx, "Term Summary")
  drawTable(ctx, rows, [
    { header: "Course / Class", value: (row) => row.course, width: 96 },
    { header: "Instructor", value: (row) => row.instructor, width: 66 },
    { header: "Attendance", value: (row) => row.attendance, width: 56 },
    { header: "Lessons", value: (row) => row.lessons, width: 46 },
    { header: "Assignments", value: (row) => row.assignments, width: 66 },
    { header: "Quizzes", value: (row) => row.quizzes, width: 58 },
    { header: "Final", value: (row) => row.finalScore, width: 54 },
    { header: "Grade", value: (row) => row.letter, width: 44 },
    { header: "Status", value: (row) => row.status, width: 58 },
  ])
  drawNote(
    ctx,
    "Student and parent downloads include published/finalized grades only. Administrative previews may include draft grades."
  )
  drawNote(ctx, "TODO: Embed Korean fonts later for production-quality Korean PDF output.")
  drawFooter(ctx, generatedAt)

  await createGeneratedDocumentMetadata({
    documentType: DocumentType.REPORT_CARD,
    organizationId: student.organizationId,
    studentId: student.id,
  })

  return {
    filename: safePdfFilename(`report-card-${student.name}-${termName}`),
    pdf: await savePdf(ctx.doc),
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
  const ctx = await createPdfContext()
  drawDocumentHeader(ctx, "Official Transcript", "University-style credit and GPA record")
  drawStudentInfo(ctx, student, generatedAt)

  for (const term of terms) {
    drawSectionHeading(ctx, term.name)
    drawTable(
      ctx,
      term.grades.map((grade) => ({
        code: grade.classSection.course.code ?? "-",
        credit: formatDecimal(grade.classSection.course.credits),
        earned: formatDecimal(grade.creditsEarned),
        gradePoint: formatDecimal(grade.gradePoint),
        letter: grade.letterGrade ?? "-",
        status: grade.status,
        title: grade.classSection.course.title,
      })),
      [
        { header: "Code", value: (row) => row.code, width: 60 },
        { header: "Course Title", value: (row) => row.title, width: 190 },
        { header: "Credit", value: (row) => row.credit, width: 50 },
        { header: "Letter", value: (row) => row.letter, width: 50 },
        { header: "Point", value: (row) => row.gradePoint, width: 50 },
        { header: "Earned", value: (row) => row.earned, width: 55 },
        { header: "Status", value: (row) => row.status, width: 72 },
      ]
    )
    drawNote(
      ctx,
      `Term GPA: ${term.gpa.toFixed(2)} | Attempted credits: ${term.attempted.toFixed(
        1
      )} | Earned credits: ${term.earned.toFixed(1)}`
    )
  }

  if (!terms.length) {
    drawNote(ctx, "No transcript grades are available yet.")
  }

  drawSectionHeading(ctx, "Cumulative Summary")
  drawKeyValueGrid(ctx, [
    ["Cumulative GPA", cumulative.gpa.toFixed(2)],
    ["Attempted credits", cumulative.attempted.toFixed(1)],
    ["Earned credits", cumulative.earned.toFixed(1)],
  ])
  drawNote(ctx, "TODO: Store generated PDFs in MinIO/FileAsset after storage is stabilized.")
  drawNote(ctx, "TODO: Embed Korean fonts later for production-quality Korean PDF output.")
  drawFooter(ctx, generatedAt)

  await createGeneratedDocumentMetadata({
    documentType: DocumentType.TRANSCRIPT,
    organizationId: student.organizationId,
    studentId: student.id,
  })

  return {
    filename: safePdfFilename(`transcript-${student.name}`),
    pdf: await savePdf(ctx.doc),
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

async function createPdfContext(): Promise<PdfContext> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage(pageSize)

  return {
    doc,
    fonts: { bold, regular },
    page,
    y: pageSize[1] - margin,
  }
}

function drawDocumentHeader(ctx: PdfContext, title: string, subtitle: string) {
  drawText(ctx, title, margin, ctx.y, {
    font: ctx.fonts.bold,
    size: 22,
  })
  ctx.y -= 18
  drawText(ctx, subtitle, margin, ctx.y, {
    color: mutedColor,
    size: 10,
  })
  ctx.y -= 20
  drawLine(ctx, margin, ctx.y, pageSize[0] - margin)
  ctx.y -= 18
}

function drawStudentInfo(
  ctx: PdfContext,
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
  },
  generatedAt: Date
) {
  drawKeyValueGrid(ctx, [
    ["School", student.organization.name],
    ["Campus", student.studentProfile?.campus?.name ?? "Organization-wide"],
    ["Student", student.name],
    ["Email", student.email ?? "-"],
    ["Student number", student.studentProfile?.studentNumber ?? "-"],
    [
      "Grade / Homeroom",
      [
        student.studentProfile?.currentGradeLevel?.name,
        student.studentProfile?.homeroom?.name,
      ]
        .filter(Boolean)
        .join(" / ") || "-",
    ],
    ["Generated at", generatedAt.toLocaleString("en-US")],
  ])
  ctx.y -= 8
}

function drawKeyValueGrid(ctx: PdfContext, items: Array<[string, string]>) {
  ensureSpace(ctx, 70)
  const x1 = margin
  const x2 = margin + 260
  let x = x1
  let rowY = ctx.y

  for (const [index, [label, value]] of items.entries()) {
    if (index > 0 && index % 2 === 0) {
      rowY -= 28
      x = x1
    }

    drawText(ctx, label.toUpperCase(), x, rowY, {
      color: mutedColor,
      font: ctx.fonts.bold,
      size: 7,
    })
    drawText(ctx, value, x, rowY - 11, {
      font: ctx.fonts.bold,
      maxWidth: 230,
      size: 9,
    })
    x = x === x1 ? x2 : x1
  }

  ctx.y = rowY - 34
}

function drawSectionHeading(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 40)
  ctx.y -= 8
  drawText(ctx, title, margin, ctx.y, {
    font: ctx.fonts.bold,
    size: 14,
  })
  ctx.y -= 10
  drawLine(ctx, margin, ctx.y, pageSize[0] - margin)
  ctx.y -= 12
}

function drawTable<T>(ctx: PdfContext, rows: T[], columns: Array<TableColumn<T>>) {
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)
  const startX = margin

  ensureSpace(ctx, 44)
  drawRect(ctx, startX, ctx.y - 18, tableWidth, 18, headerFill)

  let headerX = startX
  for (const column of columns) {
    drawText(ctx, column.header, headerX + 4, ctx.y - 12, {
      font: ctx.fonts.bold,
      maxWidth: column.width - 8,
      size: 7,
    })
    headerX += column.width
  }

  drawLine(ctx, startX, ctx.y - 18, startX + tableWidth)
  ctx.y -= 18

  if (!rows.length) {
    drawTableRow(ctx, columns, startX, tableWidth, columns.map(() => "-"))
    return
  }

  for (const row of rows) {
    const values = columns.map((column) => column.value(row))
    drawTableRow(ctx, columns, startX, tableWidth, values)
  }
}

function drawTableRow(
  ctx: PdfContext,
  columns: Array<{ width: number }>,
  startX: number,
  tableWidth: number,
  values: string[]
) {
  const wrapped = values.map((value, index) =>
    wrapText(value, columns[index].width - 8, ctx.fonts.regular, 8, 2)
  )
  const lineCount = Math.max(...wrapped.map((lines) => lines.length), 1)
  const rowHeight = Math.max(22, lineCount * rowLineHeight + 8)

  ensureSpace(ctx, rowHeight + 8)

  let x = startX
  for (const [index, column] of columns.entries()) {
    for (const [lineIndex, line] of wrapped[index].entries()) {
      drawText(ctx, line, x + 4, ctx.y - 12 - lineIndex * rowLineHeight, {
        maxWidth: column.width - 8,
        size: 8,
      })
    }
    x += column.width
  }

  drawLine(ctx, startX, ctx.y - rowHeight, startX + tableWidth)
  ctx.y -= rowHeight
}

function drawNote(ctx: PdfContext, note: string) {
  ensureSpace(ctx, 28)
  for (const line of wrapText(note, pageSize[0] - margin * 2, ctx.fonts.regular, 8, 3)) {
    drawText(ctx, line, margin, ctx.y, {
      color: mutedColor,
      size: 8,
    })
    ctx.y -= 10
  }
  ctx.y -= 4
}

function drawFooter(ctx: PdfContext, generatedAt: Date) {
  drawText(ctx, `Generated ${generatedAt.toLocaleString("en-US")}`, margin, 24, {
    color: mutedColor,
    size: 8,
  })
}

function ensureSpace(ctx: PdfContext, neededHeight: number) {
  if (ctx.y - neededHeight > margin) return

  ctx.page = ctx.doc.addPage(pageSize)
  ctx.y = pageSize[1] - margin
}

function drawText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  options: {
    color?: RGB
    font?: PDFFont
    maxWidth?: number
    size?: number
  } = {}
) {
  const font = options.font ?? ctx.fonts.regular
  const size = options.size ?? 9
  ctx.page.drawText(toPdfSafeText(text), {
    color: options.color ?? textColor,
    font,
    maxWidth: options.maxWidth,
    size,
    x,
    y,
  })
}

function drawLine(ctx: PdfContext, x: number, y: number, endX: number) {
  ctx.page.drawLine({
    color: borderColor,
    end: { x: endX, y },
    start: { x, y },
    thickness: 0.6,
  })
}

function drawRect(ctx: PdfContext, x: number, y: number, width: number, height: number, color: RGB) {
  ctx.page.drawRectangle({
    color,
    height,
    width,
    x,
    y,
  })
}

function wrapText(
  value: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
  maxLines: number
) {
  const safe = toPdfSafeText(value)
  const words = safe.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words.length ? words : ["-"]) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = word

    if (lines.length === maxLines - 1) break
  }

  if (current && lines.length < maxLines) lines.push(current)
  if (!lines.length) lines.push("-")

  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : last
  }

  return lines
}

function toPdfSafeText(value: string) {
  // pdf-lib built-in StandardFonts use WinAnsi encoding. Replace unsupported
  // characters for MVP reliability. TODO: embed a Korean font for production PDFs.
  return value
    .replace(/[^\u0020-\u00ff]/g, "?")
    .replace(/\s+/g, " ")
    .trim()
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

  return possible
    ? `${earned.toFixed(1)}/${possible.toFixed(1)}`
    : `${submitted}/${assignments.length}`
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

async function savePdf(doc: PDFDocument) {
  const bytes = await doc.save()
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}
