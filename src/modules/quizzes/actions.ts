"use server"

import { revalidatePath } from "next/cache"
import { Prisma, QuestionType, UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  canViewClassSection,
  requireAnyRole,
} from "@/modules/auth/permissions"
import type { QuizActionState } from "@/modules/quizzes/action-state"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)
const requiredString = z.string().trim().min(1)
const optionalDate = optionalString.transform((value) =>
  value ? new Date(value) : null
)
const optionalPositiveInt = z
  .preprocess((value) => {
    const text = typeof value === "string" ? value.trim() : ""
    return text.length ? text : undefined
  }, z.coerce.number().int().min(1).optional())
  .transform((value) => value ?? null)
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

async function requireQuizManager(classSectionId: string) {
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

const quizSchema = z.object({
  id: optionalString,
  classSectionId: requiredString,
  title: requiredString,
  description: optionalString,
  opensAt: optionalDate,
  closesAt: optionalDate,
  timeLimitMinutes: optionalPositiveInt,
  maxAttempts: optionalPositiveInt,
  pointsPossible: optionalDecimal,
  isPublished: z.boolean(),
  showResultsToStudents: z.boolean(),
  shuffleQuestions: z.boolean(),
})

export async function saveQuiz(
  _previousState: QuizActionState,
  formData: FormData
): Promise<QuizActionState> {
  const parsed = quizSchema.safeParse({
    id: formData.get("id") ?? "",
    classSectionId: formData.get("classSectionId") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    opensAt: formData.get("opensAt") ?? "",
    closesAt: formData.get("closesAt") ?? "",
    timeLimitMinutes: formData.get("timeLimitMinutes") ?? "",
    maxAttempts: formData.get("maxAttempts") ?? "",
    pointsPossible: formData.get("pointsPossible") ?? "",
    isPublished: formData.get("isPublished") === "on",
    showResultsToStudents: formData.get("showResultsToStudents") !== null,
    shuffleQuestions: formData.get("shuffleQuestions") === "on",
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check quiz form." }
  }

  const data = parsed.data
  await requireQuizManager(data.classSectionId)
  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true },
  })
  const { id, ...values } = data

  if (id) {
    await prisma.quiz.update({ where: { id }, data: values })
  } else {
    await prisma.quiz.create({
      data: {
        ...values,
        organizationId: classSection.organizationId,
      },
    })
  }

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
  if (id) {
    revalidatePath(`/instructor/classes/${data.classSectionId}/quizzes/${id}`)
  }
  revalidatePath(`/student/classes/${data.classSectionId}`)
  return { ok: true, message: id ? "Quiz saved." : "Quiz created." }
}

const questionSchema = z.object({
  id: optionalString,
  quizId: requiredString,
  type: z.nativeEnum(QuestionType),
  prompt: requiredString,
  points: z.coerce.number().min(0),
  sequence: z.coerce.number().int().min(1),
  correctOptionIndex: optionalPositiveInt,
  trueFalseAnswer: optionalString,
  acceptedAnswers: optionalString,
  explanation: optionalString,
})

export async function saveQuestion(
  _previousState: QuizActionState,
  formData: FormData
): Promise<QuizActionState> {
  const parsed = questionSchema.safeParse({
    id: formData.get("id") ?? "",
    quizId: formData.get("quizId") ?? "",
    type: formData.get("type") ?? QuestionType.MULTIPLE_CHOICE,
    prompt: formData.get("prompt") ?? "",
    points: formData.get("points") ?? "0",
    sequence: formData.get("sequence") ?? "1",
    correctOptionIndex: formData.get("correctOptionIndex") ?? "",
    trueFalseAnswer: formData.get("trueFalseAnswer") ?? "",
    acceptedAnswers: formData.get("acceptedAnswers") ?? "",
    explanation: formData.get("explanation") ?? "",
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check question form." }
  }

  const data = parsed.data
  const prisma = getPrismaClient()
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id: data.quizId },
    select: { organizationId: true, classSectionId: true },
  })

  await requireQuizManager(quiz.classSectionId)

  const answerKey = getAnswerKey(data)
  if (data.type !== QuestionType.ESSAY && answerKey === null) {
    return { ok: false, message: "Provide a correct answer for this question." }
  }
  const multipleChoiceOptions =
    data.type === QuestionType.MULTIPLE_CHOICE
      ? [0, 1, 2, 3]
          .map((index) => ({
            index,
            text: String(formData.get(`option${index}`) ?? "").trim(),
          }))
          .filter((option) => option.text.length > 0)
      : []

  if (data.type === QuestionType.MULTIPLE_CHOICE) {
    if (multipleChoiceOptions.length < 2) {
      return { ok: false, message: "Multiple-choice questions need at least two options." }
    }

    if (!multipleChoiceOptions.some((option) => option.index === data.correctOptionIndex)) {
      return { ok: false, message: "Select a correct option that has option text." }
    }
  }

  const question = data.id
    ? await prisma.question.update({
        where: { id: data.id },
        data: {
          type: data.type,
          prompt: data.prompt,
          points: new Prisma.Decimal(data.points),
          sequence: data.sequence,
          answerKey: answerKey ?? Prisma.JsonNull,
          rubric: data.explanation ? { explanation: data.explanation } : Prisma.JsonNull,
        },
      })
    : await prisma.question.create({
        data: {
          organizationId: quiz.organizationId,
          quizId: data.quizId,
          type: data.type,
          prompt: data.prompt,
          points: new Prisma.Decimal(data.points),
          sequence: data.sequence,
          answerKey: answerKey ?? Prisma.JsonNull,
          rubric: data.explanation ? { explanation: data.explanation } : Prisma.JsonNull,
        },
      })

  if (data.type === QuestionType.MULTIPLE_CHOICE) {
    await prisma.questionOption.deleteMany({ where: { questionId: question.id } })

    await prisma.questionOption.createMany({
      data: multipleChoiceOptions.map((option) => ({
        questionId: question.id,
        text: option.text,
        sequence: option.index + 1,
        isCorrect: option.index === data.correctOptionIndex,
      })),
    })
  } else {
    await prisma.questionOption.deleteMany({ where: { questionId: question.id } })
  }

  revalidatePath(`/instructor/classes/${quiz.classSectionId}`)
  revalidatePath(`/instructor/classes/${quiz.classSectionId}/quizzes/${data.quizId}`)
  revalidatePath(`/student/classes/${quiz.classSectionId}`)
  return { ok: true, message: data.id ? "Question saved." : "Question added." }
}

export async function deleteQuestion(
  _previousState: QuizActionState,
  formData: FormData
): Promise<QuizActionState> {
  const questionId = String(formData.get("questionId") ?? "")
  const question = await getPrismaClient().question.findUniqueOrThrow({
    where: { id: questionId },
    include: {
      quiz: { select: { classSectionId: true } },
      _count: { select: { answers: true } },
    },
  })

  await requireQuizManager(question.quiz.classSectionId)
  if (question._count.answers > 0) {
    return { ok: false, message: "Questions with attempts cannot be deleted." }
  }

  await getPrismaClient().question.delete({ where: { id: questionId } })
  revalidatePath(`/instructor/classes/${question.quiz.classSectionId}`)
  revalidatePath(`/instructor/classes/${question.quiz.classSectionId}/quizzes/${question.quizId}`)
  return { ok: true, message: "Question deleted." }
}

export async function submitQuiz(
  _previousState: QuizActionState,
  formData: FormData
): Promise<QuizActionState> {
  const student = await requireAnyRole([UserRole.STUDENT])
  const quizId = String(formData.get("quizId") ?? "")
  const prisma = getPrismaClient()
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id: quizId },
    include: {
      questions: {
        include: { options: true },
        orderBy: { sequence: "asc" },
      },
      attempts: {
        where: { studentId: student.id },
        orderBy: { attemptNumber: "desc" },
      },
    },
  })

  if (!quiz.isPublished) return { ok: false, message: "Quiz is not open." }
  if (!(await canViewClassSection(student.id, quiz.classSectionId))) {
    throw new Error("Forbidden")
  }

  const now = new Date()
  if (quiz.opensAt && quiz.opensAt > now) return { ok: false, message: "Quiz is not open yet." }
  if (quiz.closesAt && quiz.closesAt < now) return { ok: false, message: "Quiz is closed." }

  const maxAttempts = quiz.maxAttempts ?? 1
  if (quiz.attempts.length >= maxAttempts) {
    return { ok: false, message: "Maximum attempts reached." }
  }

  const attemptNumber = (quiz.attempts[0]?.attemptNumber ?? 0) + 1
  const answers = quiz.questions.map((question) =>
    gradeAutoAnswer(question, formData)
  )
  const score = answers.reduce(
    (total, answer) => total.plus(answer.score ?? 0),
    new Prisma.Decimal(0)
  )
  const needsManual = answers.some((answer) => answer.score === null)

  await prisma.quizAttempt.create({
    data: {
      organizationId: quiz.organizationId,
      quizId: quiz.id,
      studentId: student.id,
      attemptNumber,
      submittedAt: now,
      score,
      gradedAt: needsManual ? null : now,
      answers: {
        create: answers.map((answer) => ({
          questionId: answer.questionId,
          studentId: student.id,
          selectedOptionId: answer.selectedOptionId,
          answerText: answer.answerText,
          score: answer.score,
        })),
      },
    },
  })

  revalidatePath(`/student/classes/${quiz.classSectionId}`)
  revalidatePath(`/instructor/classes/${quiz.classSectionId}`)
  revalidatePath(`/instructor/classes/${quiz.classSectionId}/quizzes/${quiz.id}`)
  return { ok: true, message: needsManual ? "Quiz submitted. Manual grading is pending." : "Quiz submitted and graded." }
}

const gradeAnswerSchema = z.object({
  answerId: requiredString,
  score: z.coerce.number().min(0),
  feedback: optionalString,
})

export async function gradeQuizAnswer(
  _previousState: QuizActionState,
  formData: FormData
): Promise<QuizActionState> {
  const instructor = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const parsed = gradeAnswerSchema.safeParse({
    answerId: formData.get("answerId") ?? "",
    score: formData.get("score") ?? "",
    feedback: formData.get("feedback") ?? "",
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check grading form." }
  }

  const prisma = getPrismaClient()
  const answer = await prisma.quizAnswer.findUniqueOrThrow({
    where: { id: parsed.data.answerId },
    include: {
      question: true,
      attempt: {
        include: {
          quiz: { select: { classSectionId: true } },
          answers: true,
        },
      },
    },
  })

  if (!(await canManageClassSection(instructor.id, answer.attempt.quiz.classSectionId))) {
    throw new Error("Forbidden")
  }

  const maxScore = Number(answer.question.points)
  if (parsed.data.score > maxScore) {
    return { ok: false, message: `Score must be ${maxScore} or less.` }
  }

  await prisma.quizAnswer.update({
    where: { id: answer.id },
    data: {
      score: new Prisma.Decimal(parsed.data.score),
      feedback: parsed.data.feedback,
      gradedById: instructor.id,
      gradedAt: new Date(),
    },
  })

  const updatedAnswers = await prisma.quizAnswer.findMany({
    where: { attemptId: answer.attemptId },
    include: { question: true },
  })
  const totalScore = updatedAnswers.reduce(
    (total, item) => total.plus(item.score ?? 0),
    new Prisma.Decimal(0)
  )
  const hasPendingManual = updatedAnswers.some(
    (item) =>
      (item.question.type === QuestionType.ESSAY ||
        item.question.type === QuestionType.SHORT_ANSWER) &&
      item.score === null
  )

  await prisma.quizAttempt.update({
    where: { id: answer.attemptId },
    data: {
      score: totalScore,
      gradedById: hasPendingManual ? null : instructor.id,
      gradedAt: hasPendingManual ? null : new Date(),
    },
  })

  revalidatePath(`/instructor/classes/${answer.attempt.quiz.classSectionId}`)
  revalidatePath(
    `/instructor/classes/${answer.attempt.quiz.classSectionId}/quizzes/${answer.attempt.quizId}`
  )
  revalidatePath(`/student/classes/${answer.attempt.quiz.classSectionId}`)
  return { ok: true, message: "Answer graded." }
}

const examSchema = z.object({
  id: optionalString,
  classSectionId: requiredString,
  title: requiredString,
  examType: optionalString,
  startsAt: optionalDate,
  endsAt: optionalDate,
  location: optionalString,
  pointsPossible: optionalDecimal,
  weight: optionalDecimal,
  description: optionalString,
})

export async function saveExam(
  _previousState: QuizActionState,
  formData: FormData
): Promise<QuizActionState> {
  const parsed = examSchema.safeParse({
    id: formData.get("id") ?? "",
    classSectionId: formData.get("classSectionId") ?? "",
    title: formData.get("title") ?? "",
    examType: formData.get("examType") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
    location: formData.get("location") ?? "",
    pointsPossible: formData.get("pointsPossible") ?? "",
    weight: formData.get("weight") ?? "",
    description: formData.get("description") ?? "",
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check exam form." }
  }

  const data = parsed.data
  await requireQuizManager(data.classSectionId)
  const classSection = await getPrismaClient().classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true },
  })
  const { id, ...values } = data

  await getPrismaClient().exam.upsert({
    where: { id: id ?? "__new_exam__" },
    update: values,
    create: {
      ...values,
      organizationId: classSection.organizationId,
    },
  })

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
  return { ok: true, message: id ? "Exam saved." : "Exam created." }
}

function getAnswerKey(data: z.infer<typeof questionSchema>) {
  if (data.type === QuestionType.MULTIPLE_CHOICE) {
    return data.correctOptionIndex === null
      ? null
      : { correctOptionIndex: data.correctOptionIndex }
  }

  if (data.type === QuestionType.TRUE_FALSE) {
    if (data.trueFalseAnswer !== "true" && data.trueFalseAnswer !== "false") return null
    return { correctBoolean: data.trueFalseAnswer === "true" }
  }

  if (data.type === QuestionType.SHORT_ANSWER) {
    const acceptedAnswers = (data.acceptedAnswers ?? "")
      .split(/\r?\n|,/)
      .map((answer) => answer.trim())
      .filter(Boolean)
    return acceptedAnswers.length ? { acceptedAnswers } : null
  }

  return null
}

function gradeAutoAnswer(
  question: {
    id: string
    type: QuestionType
    points: Prisma.Decimal
    answerKey: Prisma.JsonValue
    options: Array<{ id: string; isCorrect: boolean }>
  },
  formData: FormData
) {
  if (question.type === QuestionType.MULTIPLE_CHOICE) {
    const selectedOptionId = String(formData.get(`answer_${question.id}`) ?? "")
    const selected = question.options.find((option) => option.id === selectedOptionId)
    return {
      questionId: question.id,
      selectedOptionId: selectedOptionId || null,
      answerText: null,
      score: selected?.isCorrect ? question.points : new Prisma.Decimal(0),
    }
  }

  if (question.type === QuestionType.TRUE_FALSE) {
    const answerText = String(formData.get(`answer_${question.id}`) ?? "")
    const key = question.answerKey as { correctBoolean?: boolean } | null
    return {
      questionId: question.id,
      selectedOptionId: null,
      answerText,
      score:
        String(key?.correctBoolean) === answerText
          ? question.points
          : new Prisma.Decimal(0),
    }
  }

  if (question.type === QuestionType.SHORT_ANSWER) {
    const answerText = String(formData.get(`answer_${question.id}`) ?? "").trim()
    const key = question.answerKey as { acceptedAnswers?: string[] } | null
    const isCorrect =
      answerText.length > 0 &&
      (key?.acceptedAnswers ?? []).some(
        (answer) => answer.toLowerCase() === answerText.toLowerCase()
      )
    return {
      questionId: question.id,
      selectedOptionId: null,
      answerText,
      score: isCorrect ? question.points : new Prisma.Decimal(0),
    }
  }

  return {
    questionId: question.id,
    selectedOptionId: null,
    answerText: String(formData.get(`answer_${question.id}`) ?? ""),
    score: null,
  }
}
