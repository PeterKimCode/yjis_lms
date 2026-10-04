import Link from "next/link"
import { notFound } from "next/navigation"
import { Prisma, UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { canManageClassSection, requireAnyRole } from "@/modules/auth/permissions"
import {
  DashboardPage,
} from "@/modules/dashboards/components"
import {
  AssessmentHeader,
  StudentAssessmentPaper,
  QuizManagePanel,
  type QuizPanelValue,
} from "@/modules/quizzes/quiz-panel"

export default async function InstructorQuizManagePage({
  params,
  searchParams,
}: {
  searchParams: Promise<{ uploadFailed?: string; preview?: string; view?: string }>
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
  const { uploadFailed, preview, view } = await searchParams

  if (!(await canManageClassSection(user.id, classSectionId))) {
    notFound()
  }

  const quiz = await getPrismaClient().quiz.findFirst({
    where: {
      id: quizId,
      archivedAt: null,
      classSectionId,
    },
    include: {
      classSection: {
        include: {
          organization: {select:{timezone:true}},
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

  return (
    <DashboardPage
      title={preview === "1" ? "Student preview" : view === "1" ? "Assessment details" : "Edit assessment"}
      description={`${quiz.classSection.name} - ${quiz.classSection.course.title} - ${
        quiz.classSection.term?.name ?? "No term"
      }`}
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary" className="border border-slate-300 bg-slate-800 text-white hover:bg-slate-700">
          <Link href={`/instructor/classes/${classSectionId}?tab=assessments&view=quizzes`}>
            ← Back to Exams / Quiz
          </Link>
        </Button>
      </div>

      <AssessmentHeader quiz={panelQuiz}/>
      {preview === "1" || view === "1" ? <><Button asChild variant="outline"><Link href={`/instructor/classes/${classSectionId}/quizzes/${quizId}`}>Edit / Grade</Link></Button><StudentAssessmentPaper quiz={panelQuiz} now={new Date().toISOString()} preview/></> : <QuizManagePanel classSectionId={classSectionId} quiz={panelQuiz} uploadFailed={uploadFailed === "1"} />}

    </DashboardPage>
  )
}

type QuizManageData = Prisma.QuizGetPayload<{
  include: {
    classSection: {
      include: {
        organization: {select:{timezone:true}}
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
    assessmentType: quiz.assessmentType,
    location: quiz.location,
    timeZone: quiz.classSection.organization.timezone,
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
