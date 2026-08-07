import Link from "next/link"
import { notFound } from "next/navigation"
import { Prisma, UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { canManageClassSection, requireAnyRole } from "@/modules/auth/permissions"
import {
  DashboardPage,
  MetricCard,
} from "@/modules/dashboards/components"
import {
  QuizManagePanel,
  type QuizPanelValue,
} from "@/modules/quizzes/quiz-panel"
import { getQuizAttemptStatus } from "@/modules/quizzes/status"

export default async function InstructorQuizManagePage({
  params,
}: {
  params: Promise<{ classSectionId: string; quizId: string }>
}) {
  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const { classSectionId, quizId } = await params

  if (!(await canManageClassSection(user.id, classSectionId))) {
    notFound()
  }

  const quiz = await getPrismaClient().quiz.findFirst({
    where: {
      id: quizId,
      classSectionId,
    },
    include: {
      classSection: {
        include: {
          campus: true,
          course: true,
          term: true,
        },
      },
      questions: {
        include: {
          options: {
            orderBy: { sequence: "asc" },
          },
        },
        orderBy: { sequence: "asc" },
      },
      attempts: {
        include: {
          student: true,
          answers: {
            include: {
              question: true,
              selectedOption: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      attachments: {
        include: {
          fileAsset: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!quiz) {
    notFound()
  }

  const panelQuiz = toQuizPanelValue(quiz)
  const gradedCount = panelQuiz.attempts.filter(
    (attempt) => getQuizAttemptStatus(attempt) === "Graded"
  ).length

  return (
    <DashboardPage
      title={quiz.title}
      description={`${quiz.classSection.name} - ${quiz.classSection.course.title} - ${
        quiz.classSection.term?.name ?? "No term"
      }`}
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/instructor/classes/${classSectionId}`}>
            Back to class
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Questions" value={quiz.questions.length} />
        <MetricCard label="Attempts" value={quiz.attempts.length} />
        <MetricCard label="Graded" value={gradedCount} />
        <MetricCard
          label="Status"
          value={quiz.isPublished ? "Published" : "Draft"}
        />
      </div>

      <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="font-medium text-foreground">Opens:</span>{" "}
            {formatDateTime(quiz.opensAt)}
          </div>
          <div>
            <span className="font-medium text-foreground">Closes:</span>{" "}
            {formatDateTime(quiz.closesAt)}
          </div>
          <div>
            <span className="font-medium text-foreground">Time limit:</span>{" "}
            {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} minutes` : "No limit"}
          </div>
          <div>
            <span className="font-medium text-foreground">Max attempts:</span>{" "}
            {quiz.maxAttempts ?? 1}
          </div>
        </div>
        {quiz.description ? <p className="mt-3">{quiz.description}</p> : null}
      </div>

      <QuizManagePanel classSectionId={classSectionId} quiz={panelQuiz} />
    </DashboardPage>
  )
}

type QuizManageData = Prisma.QuizGetPayload<{
  include: {
    classSection: {
      include: {
        campus: true
        course: true
        term: true
      }
    }
    questions: {
      include: {
        options: true
      }
    }
    attempts: {
      include: {
        student: true
        answers: {
          include: {
            question: true
            selectedOption: true
          }
        }
      }
    }
    attachments: {
      include: {
        fileAsset: true
      }
    }
  }
}>

function toQuizPanelValue(quiz: QuizManageData) {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    opensAt: quiz.opensAt?.toISOString() ?? null,
    closesAt: quiz.closesAt?.toISOString() ?? null,
    timeLimitMinutes: quiz.timeLimitMinutes,
    maxAttempts: quiz.maxAttempts,
    pointsPossible: quiz.pointsPossible?.toString() ?? null,
    isPublished: quiz.isPublished,
    showResultsToStudents: quiz.showResultsToStudents,
    shuffleQuestions: quiz.shuffleQuestions,
    attachments: quiz.attachments.map(({ fileAsset }) => ({
      id: fileAsset.id,
      name: fileAsset.originalName,
    })),
    questions: quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      points: question.points.toString(),
      sequence: question.sequence,
      explanation: getQuestionExplanation(question.rubric),
      answerKey: question.answerKey,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        sequence: option.sequence,
      })),
    })),
    attempts: quiz.attempts.map((attempt) => ({
      id: attempt.id,
      studentId: attempt.studentId,
      studentName: attempt.student.name,
      studentEmail: attempt.student.email,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      score: attempt.score?.toString() ?? null,
      gradedAt: attempt.gradedAt?.toISOString() ?? null,
      answers: attempt.answers.map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        questionPrompt: answer.question.prompt,
        questionType: answer.question.type,
        questionPoints: answer.question.points.toString(),
        answerText: answer.answerText,
        selectedOptionText: answer.selectedOption?.text ?? null,
        score: answer.score?.toString() ?? null,
        feedback: answer.feedback,
      })),
    })),
  } satisfies QuizPanelValue
}

function getQuestionExplanation(rubric: unknown) {
  if (!rubric || typeof rubric !== "object" || Array.isArray(rubric)) {
    return null
  }

  const explanation = (rubric as { explanation?: unknown }).explanation
  return typeof explanation === "string" && explanation.length ? explanation : null
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-"
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
