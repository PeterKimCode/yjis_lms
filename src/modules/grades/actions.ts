"use server"

import { revalidatePath } from "next/cache"
import {
  AttendanceStatus,
  FinalGradeStatus,
  Prisma,
  UserRole,
} from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  requireAnyRole,
} from "@/modules/auth/permissions"
import type { GradebookActionState } from "@/modules/grades/action-state"
import { getAttendanceSummary } from "@/modules/attendance/summary"
import { resolvePolicies } from "@/modules/policies/resolve"
import type { AttendancePolicyValue } from "@/modules/policies/types"

const requiredString = z.string().trim().min(1)
const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)
const optionalDate = optionalString.transform((value) =>
  value ? new Date(value) : null
)
const optionalDecimal = z.preprocess(
  (value) => {
    const text = typeof value === "string" ? value.trim() : ""
    return text.length ? text : undefined
  },
  z.coerce
    .number()
    .min(0)
    .optional()
    .transform((value) => (value === undefined ? null : new Prisma.Decimal(value)))
)
const weightSchema = z.object({
  classSectionId: requiredString,
  lessonsWeight: z.coerce.number().min(0).max(100),
  attendanceWeight: z.coerce.number().min(0).max(100),
  assignmentsWeight: z.coerce.number().min(0).max(100),
  quizzesWeight: z.coerce.number().min(0).max(100),
  examsWeight: z.coerce.number().min(0).max(100),
})

export async function saveModuleGradingConfig(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const parsed = weightSchema.safeParse({
    classSectionId: formData.get("classSectionId") ?? "",
    lessonsWeight: formData.get("lessonsWeight") ?? "10",
    attendanceWeight: formData.get("attendanceWeight") ?? "20",
    assignmentsWeight: formData.get("assignmentsWeight") ?? "30",
    quizzesWeight: formData.get("quizzesWeight") ?? "20",
    examsWeight: formData.get("examsWeight") ?? "20",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: "Weights must be numbers from 0 to 100.",
    }
  }

  await requireGradebookManager(parsed.data.classSectionId)
  await getPrismaClient().classSectionGradingConfig.upsert({
    where: { classSectionId: parsed.data.classSectionId },
    update: toWeightData(parsed.data),
    create: {
      classSectionId: parsed.data.classSectionId,
      ...toWeightData(parsed.data),
    },
  })

  revalidateGradebookPaths(parsed.data.classSectionId)
  return { ok: true, message: "Grade weights saved." }
}

const categorySchema = z.object({
  id: optionalString,
  classSectionId: requiredString,
  name: requiredString,
  weight: z.coerce
    .number()
    .min(0, "Category weight must be 0 or greater.")
    .max(100, "Category weight must be 100 or less."),
  sequence: z.coerce
    .number()
    .int("Category order must be a whole number.")
    .min(1, "Category order must be 1 or greater."),
})

export async function saveGradeCategory(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const parsed = categorySchema.safeParse({
    id: formData.get("id") ?? "",
    classSectionId: formData.get("classSectionId") ?? "",
    name: formData.get("name") ?? "",
    weight: formData.get("weight") ?? "",
    sequence: formData.get("sequence") ?? "1",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check category fields.",
    }
  }

  const user = await requireGradebookManager(parsed.data.classSectionId)
  const prisma = getPrismaClient()
  const section = await prisma.classSection.findUniqueOrThrow({
    where: { id: parsed.data.classSectionId },
    select: { organizationId: true, termId: true },
  })
  const { id, ...data } = parsed.data

  if (id) {
    await prisma.gradeCategory.update({
      where: { id },
      data: {
        name: data.name,
        weight: new Prisma.Decimal(data.weight),
        sequence: data.sequence,
      },
    })
  } else {
    await prisma.gradeCategory.create({
      data: {
        organizationId: section.organizationId,
        classSectionId: data.classSectionId,
        termId: section.termId,
        name: data.name,
        weight: new Prisma.Decimal(data.weight),
        sequence: data.sequence,
      },
    })
  }

  revalidateGradebookPaths(data.classSectionId, user.id)
  return { ok: true, message: id ? "Category saved." : "Category created." }
}

export async function deleteGradeCategory(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const categoryId = String(formData.get("categoryId") ?? "")
  const category = await getPrismaClient().gradeCategory.findUniqueOrThrow({
    where: { id: categoryId },
    include: {
      _count: { select: { gradeItems: true } },
    },
  })

  await requireGradebookManager(category.classSectionId)
  if (category._count.gradeItems > 0) {
    return { ok: false, message: "Delete grade items before deleting this category." }
  }

  await getPrismaClient().gradeCategory.delete({ where: { id: categoryId } })
  revalidateGradebookPaths(category.classSectionId)
  return { ok: true, message: "Category deleted." }
}

const itemSchema = z.object({
  id: optionalString,
  classSectionId: requiredString,
  categoryId: optionalString,
  sourceType: z.enum(["ATTENDANCE", "ASSIGNMENT", "QUIZ", "EXAM", "CUSTOM"]),
  sourceId: optionalString,
  title: requiredString,
  pointsPossible: z.coerce
    .number()
    .min(0.01, "Max score must be greater than 0."),
  weight: optionalDecimal,
  dueAt: optionalDate,
})

export async function saveGradeItem(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const parsed = itemSchema.safeParse({
    id: formData.get("id") ?? "",
    classSectionId: formData.get("classSectionId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    sourceType: formData.get("sourceType") ?? "CUSTOM",
    sourceId: formData.get("sourceId") ?? "",
    title: formData.get("title") ?? "",
    pointsPossible: formData.get("pointsPossible") ?? "",
    weight: formData.get("weight") ?? "",
    dueAt: formData.get("dueAt") ?? "",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check grade item fields.",
    }
  }

  const user = await requireGradebookManager(parsed.data.classSectionId)
  const prisma = getPrismaClient()
  const section = await prisma.classSection.findUniqueOrThrow({
    where: { id: parsed.data.classSectionId },
    select: { organizationId: true, termId: true },
  })
  const { id, sourceId, sourceType, ...data } = parsed.data
  const source = getSourceFields(sourceType, sourceId)

  if (id) {
    await prisma.gradeItem.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        title: data.title,
        pointsPossible: new Prisma.Decimal(data.pointsPossible),
        weight: data.weight,
        dueAt: data.dueAt,
        ...source,
      },
    })
  } else {
    await prisma.gradeItem.create({
      data: {
        organizationId: section.organizationId,
        classSectionId: data.classSectionId,
        termId: section.termId,
        categoryId: data.categoryId,
        title: data.title,
        pointsPossible: new Prisma.Decimal(data.pointsPossible),
        weight: data.weight,
        dueAt: data.dueAt,
        ...source,
      },
    })
  }

  revalidateGradebookPaths(data.classSectionId, user.id)
  return { ok: true, message: id ? "Grade item saved." : "Grade item created." }
}

export async function deleteGradeItem(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const gradeItemId = String(formData.get("gradeItemId") ?? "")
  const item = await getPrismaClient().gradeItem.findUniqueOrThrow({
    where: { id: gradeItemId },
    include: {
      _count: { select: { scores: true } },
    },
  })

  await requireGradebookManager(item.classSectionId)
  if (item._count.scores > 0) {
    return { ok: false, message: "Grade items with scores cannot be deleted." }
  }

  await getPrismaClient().gradeItem.delete({ where: { id: gradeItemId } })
  revalidateGradebookPaths(item.classSectionId)
  return { ok: true, message: "Grade item deleted." }
}

const scoreSchema = z.object({
  gradeItemId: requiredString,
  studentId: requiredString,
  score: z.coerce.number().min(0, "Score must be 0 or greater."),
  feedback: optionalString,
})

export async function saveGradeScore(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const parsed = scoreSchema.safeParse({
    gradeItemId: formData.get("gradeItemId") ?? "",
    studentId: formData.get("studentId") ?? "",
    score: formData.get("score") ?? "",
    feedback: formData.get("feedback") ?? "",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check score fields.",
    }
  }

  const prisma = getPrismaClient()
  const item = await prisma.gradeItem.findUniqueOrThrow({
    where: { id: parsed.data.gradeItemId },
  })
  const grader = await requireGradebookManager(item.classSectionId)
  const maxScore = Number(item.pointsPossible)

  if (parsed.data.score > maxScore) {
    return { ok: false, message: `Score must be ${maxScore} or less.` }
  }

  const score = new Prisma.Decimal(parsed.data.score)
  const percentage = score.div(item.pointsPossible).mul(100)

  await prisma.gradeScore.upsert({
    where: {
      gradeItemId_studentId: {
        gradeItemId: item.id,
        studentId: parsed.data.studentId,
      },
    },
    update: {
      score,
      percentage,
      feedback: parsed.data.feedback,
      gradedById: grader.id,
      gradedAt: new Date(),
    },
    create: {
      organizationId: item.organizationId,
      gradeItemId: item.id,
      studentId: parsed.data.studentId,
      score,
      percentage,
      feedback: parsed.data.feedback,
      gradedById: grader.id,
      gradedAt: new Date(),
    },
  })

  revalidateGradebookPaths(item.classSectionId, grader.id)
  return { ok: true, message: "Score saved." }
}

export async function calculateFinalGrades(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const classSectionId = String(formData.get("classSectionId") ?? "")
  await requireGradebookManager(classSectionId)

  const prisma = getPrismaClient()
  const section = await prisma.classSection.findUniqueOrThrow({
    where: { id: classSectionId },
    include: {
      course: true,
      gradingConfig: true,
      lessons: {
        where: { isPublished: true },
        include: { videoProgress: true },
      },
      enrollments: true,
      attendanceSessions: {
        include: { records: true },
      },
      assignments: {
        include: { submissions: true },
      },
      quizzes: {
        include: {
          questions: true,
          attempts: true,
        },
      },
      exams: true,
    },
  })
  const policies = await resolvePolicies({
    organizationId: section.organizationId,
    campusId: section.campusId,
    classSectionId: section.id,
  })
  const scale = policies.gradingScale

  if (!scale) {
    return {
      ok: false,
      message: "No grading scale is configured for this organization/campus.",
    }
  }

  const weights = getWeights(section.gradingConfig)
  const credit = section.course.credits ?? new Prisma.Decimal(0)

  for (const enrollment of section.enrollments) {
    const moduleScores = calculateModuleScores(
      section,
      enrollment.studentId,
      policies.attendance
    )
    const total = moduleScores.lessonsScore
      .mul(weights.lessonsWeight)
      .plus(moduleScores.attendanceScore.mul(weights.attendanceWeight))
      .plus(moduleScores.assignmentsScore.mul(weights.assignmentsWeight))
      .plus(moduleScores.quizzesScore.mul(weights.quizzesWeight))
      .plus(moduleScores.examsScore.mul(weights.examsWeight))
      .div(100)

    const scaleItem = findScaleItem(scale.items, total)
    const isPassed = scaleItem?.gradePoint
      ? scaleItem.gradePoint.gt(0)
      : total.gte(60)

    await upsertFinalGrade({
      classSectionId: section.id,
      credit,
      gradePoint: scaleItem?.gradePoint ?? null,
      gradingScaleId: scale.id,
      letterGrade: scaleItem?.label ?? null,
      organizationId: section.organizationId,
      percentage: total,
      prisma,
      status: FinalGradeStatus.DRAFT,
      studentId: enrollment.studentId,
      termId: section.termId,
      creditsEarned: isPassed ? credit : new Prisma.Decimal(0),
    })
  }

  revalidateGradebookPaths(classSectionId)
  return {
    ok: true,
    message: "Final grades calculated from module weights.",
  }
}

export async function publishFinalGrades(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const classSectionId = String(formData.get("classSectionId") ?? "")
  await requireGradebookManager(classSectionId)

  await getPrismaClient().finalGrade.updateMany({
    where: { classSectionId },
    data: {
      status: FinalGradeStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  })

  revalidateGradebookPaths(classSectionId)
  return { ok: true, message: "Final grades published." }
}

export async function finalizeFinalGrades(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const classSectionId = String(formData.get("classSectionId") ?? "")
  await requireGradebookManager(classSectionId)

  await getPrismaClient().finalGrade.updateMany({
    where: { classSectionId },
    data: {
      status: FinalGradeStatus.FINALIZED,
      publishedAt: new Date(),
    },
  })

  revalidateGradebookPaths(classSectionId)
  return { ok: true, message: "Final grades finalized." }
}

export async function generateTranscriptsForClassSection(
  _previousState: GradebookActionState,
  formData: FormData
): Promise<GradebookActionState> {
  const classSectionId = String(formData.get("classSectionId") ?? "")
  await requireGradebookManager(classSectionId)

  const prisma = getPrismaClient()
  const section = await prisma.classSection.findUniqueOrThrow({
    where: { id: classSectionId },
    include: {
      academicYear: true,
      term: true,
      course: true,
      finalGrades: {
        where: {
          status: { in: [FinalGradeStatus.PUBLISHED, FinalGradeStatus.FINALIZED] },
        },
      },
    },
  })

  const studentIds = [...new Set(section.finalGrades.map((grade) => grade.studentId))]
  for (const studentId of studentIds) {
    const finalGrades = await prisma.finalGrade.findMany({
      where: {
        organizationId: section.organizationId,
        studentId,
        status: { in: [FinalGradeStatus.PUBLISHED, FinalGradeStatus.FINALIZED] },
      },
      include: {
        classSection: {
          include: {
            course: true,
            term: true,
            academicYear: true,
          },
        },
      },
    })
    const transcript =
      (await prisma.transcript.findFirst({
        where: {
          organizationId: section.organizationId,
          academicYearId: section.academicYearId,
          studentId,
        },
      })) ??
      (await prisma.transcript.create({
        data: {
          organizationId: section.organizationId,
          academicYearId: section.academicYearId,
          studentId,
          title: `${section.academicYear.name} Transcript`,
        },
      }))

    const byTerm = new Map<string, typeof finalGrades>()
    for (const grade of finalGrades) {
      const key = grade.termId ?? "no-term"
      byTerm.set(key, [...(byTerm.get(key) ?? []), grade])
    }

    let cumulativePoints = new Prisma.Decimal(0)
    let cumulativeCredits = new Prisma.Decimal(0)
    let cumulativeEarned = new Prisma.Decimal(0)

    for (const [termKey, grades] of byTerm) {
      const termId = termKey === "no-term" ? null : termKey
      const termName = grades[0]?.classSection.term?.name ?? "No term"
      const transcriptTerm =
        (await prisma.transcriptTerm.findFirst({
          where: { transcriptId: transcript.id, termId },
        })) ??
        (await prisma.transcriptTerm.create({
          data: {
            organizationId: section.organizationId,
            transcriptId: transcript.id,
            termId,
            name: termName,
          },
        }))

      await prisma.transcriptItem.deleteMany({
        where: { transcriptTermId: transcriptTerm.id },
      })

      let termPoints = new Prisma.Decimal(0)
      let termCredits = new Prisma.Decimal(0)
      let termEarned = new Prisma.Decimal(0)

      for (const grade of grades) {
        const attempted = grade.classSection.course.credits ?? new Prisma.Decimal(0)
        const gradePoint = grade.gradePoint ?? new Prisma.Decimal(0)
        const earned = grade.creditsEarned ?? new Prisma.Decimal(0)
        termPoints = termPoints.plus(attempted.mul(gradePoint))
        termCredits = termCredits.plus(attempted)
        termEarned = termEarned.plus(earned)

        await prisma.transcriptItem.create({
          data: {
            organizationId: section.organizationId,
            transcriptTermId: transcriptTerm.id,
            finalGradeId: grade.id,
            courseCode: grade.classSection.course.code,
            courseTitle: grade.classSection.course.title,
            credits: attempted,
            letterGrade: grade.letterGrade,
            gradePoint,
          },
        })
      }

      cumulativePoints = cumulativePoints.plus(termPoints)
      cumulativeCredits = cumulativeCredits.plus(termCredits)
      cumulativeEarned = cumulativeEarned.plus(termEarned)

      await prisma.transcriptTerm.update({
        where: { id: transcriptTerm.id },
        data: {
          termGpa: termCredits.gt(0) ? termPoints.div(termCredits) : null,
          creditsAttempted: termCredits,
          creditsEarned: termEarned,
        },
      })
    }

    await prisma.transcript.update({
      where: { id: transcript.id },
      data: {
        cumulativeGpa: cumulativeCredits.gt(0)
          ? cumulativePoints.div(cumulativeCredits)
          : null,
        totalCredits: cumulativeEarned,
      },
    })
  }

  revalidateGradebookPaths(classSectionId)
  return { ok: true, message: "Transcript and GPA records updated." }
}

async function requireGradebookManager(classSectionId: string) {
  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])

  if (!(await canManageClassSection(user.id, classSectionId))) {
    throw new Error("Forbidden")
  }

  return user
}

function getSourceFields(sourceType: string, sourceId: string | null) {
  return {
    assignmentId: sourceType === "ASSIGNMENT" ? sourceId : null,
    quizId: sourceType === "QUIZ" ? sourceId : null,
    examId: sourceType === "EXAM" ? sourceId : null,
  }
}

function toWeightData(data: z.infer<typeof weightSchema>) {
  return {
    lessonsWeight: new Prisma.Decimal(data.lessonsWeight),
    attendanceWeight: new Prisma.Decimal(data.attendanceWeight),
    assignmentsWeight: new Prisma.Decimal(data.assignmentsWeight),
    quizzesWeight: new Prisma.Decimal(data.quizzesWeight),
    examsWeight: new Prisma.Decimal(data.examsWeight),
  }
}

function getWeights(config: {
  lessonsWeight: Prisma.Decimal
  attendanceWeight: Prisma.Decimal
  assignmentsWeight: Prisma.Decimal
  quizzesWeight: Prisma.Decimal
  examsWeight: Prisma.Decimal
} | null) {
  return {
    lessonsWeight: config?.lessonsWeight ?? new Prisma.Decimal(10),
    attendanceWeight: config?.attendanceWeight ?? new Prisma.Decimal(20),
    assignmentsWeight: config?.assignmentsWeight ?? new Prisma.Decimal(30),
    quizzesWeight: config?.quizzesWeight ?? new Prisma.Decimal(20),
    examsWeight: config?.examsWeight ?? new Prisma.Decimal(20),
  }
}

function calculateModuleScores(
  section: {
    lessons: Array<{
      videoProgress: Array<{ studentId: string; completed: boolean }>
    }>
    attendanceSessions: Array<{
      records: Array<{ studentId: string; status: AttendanceStatus }>
    }>
    assignments: Array<{
      pointsPossible: Prisma.Decimal | null
      dueAt: Date | null
      submissions: Array<{ studentId: string; score: Prisma.Decimal | null }>
    }>
    quizzes: Array<{
      pointsPossible: Prisma.Decimal | null
      questions: Array<{ points: Prisma.Decimal }>
      attempts: Array<{
        studentId: string
        score: Prisma.Decimal | null
        submittedAt: Date | null
      }>
    }>
    exams: unknown[]
  },
  studentId: string,
  attendancePolicy: AttendancePolicyValue
) {
  const now = new Date()
  const publishedLessons = section.lessons
  const completedLessons = publishedLessons.filter((lesson) =>
    lesson.videoProgress.some(
      (progress) => progress.studentId === studentId && progress.completed
    )
  ).length
  const lessonsScore = publishedLessons.length
    ? new Prisma.Decimal(completedLessons).div(publishedLessons.length).mul(100)
    : new Prisma.Decimal(0)

  const attendanceRecords = section.attendanceSessions.flatMap((session) =>
    session.records.filter((record) => record.studentId === studentId)
  )
  const attendanceSummary = getAttendanceSummary(attendanceRecords, attendancePolicy)
  const attendanceScore = new Prisma.Decimal(attendanceSummary.attendanceRate)

  const gradedAssignments = section.assignments.filter(
    (assignment) =>
      assignment.dueAt === null ||
      assignment.dueAt <= now ||
      assignment.submissions.some((submission) => submission.studentId === studentId)
  )
  const assignmentTotals = gradedAssignments.reduce(
    (total, assignment) => {
      const possible = assignment.pointsPossible ?? new Prisma.Decimal(100)
      const submission = assignment.submissions.find(
        (entry) => entry.studentId === studentId
      )
      return {
        earned: total.earned.plus(submission?.score ?? 0),
        possible: total.possible.plus(possible),
      }
    },
    { earned: new Prisma.Decimal(0), possible: new Prisma.Decimal(0) }
  )
  const assignmentsScore = assignmentTotals.possible.gt(0)
    ? assignmentTotals.earned.div(assignmentTotals.possible).mul(100)
    : new Prisma.Decimal(0)

  const quizTotals = section.quizzes.reduce(
    (total, quiz) => {
      const possible =
        quiz.pointsPossible ??
        quiz.questions.reduce(
          (sum, question) => sum.plus(question.points),
          new Prisma.Decimal(0)
        )
      if (possible.lte(0)) return total
      const best = quiz.attempts
        .filter((attempt) => attempt.studentId === studentId && attempt.submittedAt)
        .reduce<Prisma.Decimal | null>((current, attempt) => {
          if (!attempt.score) return current
          return current === null || attempt.score.gt(current)
            ? attempt.score
            : current
        }, null)
      return {
        earned: total.earned.plus(best ?? 0),
        possible: total.possible.plus(possible),
      }
    },
    { earned: new Prisma.Decimal(0), possible: new Prisma.Decimal(0) }
  )
  const quizzesScore = quizTotals.possible.gt(0)
    ? quizTotals.earned.div(quizTotals.possible).mul(100)
    : new Prisma.Decimal(0)

  return {
    lessonsScore,
    attendanceScore,
    assignmentsScore,
    quizzesScore,
    examsScore: section.exams.length ? new Prisma.Decimal(0) : new Prisma.Decimal(0),
  }
}

function findScaleItem(
  items: Array<{
    label: string
    minPercentage: Prisma.Decimal
    maxPercentage: Prisma.Decimal
    gradePoint: Prisma.Decimal | null
  }>,
  percentage: Prisma.Decimal
) {
  return items.find(
    (item) =>
      percentage.gte(item.minPercentage) && percentage.lte(item.maxPercentage)
  )
}

async function upsertFinalGrade({
  classSectionId,
  credit,
  creditsEarned,
  gradePoint,
  gradingScaleId,
  letterGrade,
  organizationId,
  percentage,
  prisma,
  status,
  studentId,
  termId,
}: {
  classSectionId: string
  credit: Prisma.Decimal
  creditsEarned: Prisma.Decimal
  gradePoint: Prisma.Decimal | null
  gradingScaleId: string
  letterGrade: string | null
  organizationId: string
  percentage: Prisma.Decimal
  prisma: ReturnType<typeof getPrismaClient>
  status: FinalGradeStatus
  studentId: string
  termId: string | null
}) {
  const existing = await prisma.finalGrade.findFirst({
    where: { classSectionId, studentId, termId },
  })
  const data = {
    organizationId,
    classSectionId,
    termId,
    studentId,
    gradingScaleId,
    numericScore: percentage,
    percentage,
    letterGrade,
    gradePoint,
    creditsEarned,
    status,
  }

  if (existing) {
    await prisma.finalGrade.update({
      where: { id: existing.id },
      data,
    })
  } else {
    await prisma.finalGrade.create({ data })
  }

  void credit
}

function revalidateGradebookPaths(classSectionId: string, userId?: string) {
  revalidatePath(`/instructor/classes/${classSectionId}`)
  revalidatePath(`/student/classes/${classSectionId}`)
  if (userId) {
    revalidatePath(`/parent/students/${userId}`)
  }
}
