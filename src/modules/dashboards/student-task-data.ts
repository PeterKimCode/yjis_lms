import "server-only"
import { getPrismaClient } from "@/lib/prisma"
import { groupStudentTasks, quizTaskStatus, type StudentTask } from "./student-tasks"

export async function getStudentTaskGroups(studentId: string, now = new Date()) {
  const sections = await getPrismaClient().classSection.findMany({
    where: { enrollments: { some: { studentId, status: "ENROLLED" } } },
    select: {
      id: true, name: true, organization: { select: { timezone: true } },
      assignments: { select: { id: true, title: true, dueAt: true, acceptsLate: true, submissions: { where: { studentId }, select: { submittedAt: true } } } },
      quizzes: { where: { isPublished: true, archivedAt: null }, select: { id: true, title: true, isPublished: true, archivedAt: true, opensAt: true, closesAt: true, maxAttempts: true, _count: { select: { questions: true } }, attempts: { where: { studentId }, select: { submittedAt: true } } } },
    },
  })
  const tasks: StudentTask[] = sections.flatMap((section) => {
    const shared = { className: section.name, timeZone: section.organization.timezone || "Asia/Seoul" }
    return [
      ...section.assignments.map((assignment): StudentTask => ({ ...shared, id: `assignment:${assignment.id}`, title: assignment.title, dueAt: assignment.dueAt, kind: "Assignment", submitted: assignment.submissions.some((submission) => Boolean(submission.submittedAt)), status: assignment.dueAt && assignment.dueAt < now ? assignment.acceptsLate ? "Late submission allowed" : "Closed" : "Available", href: `/student/classes/${section.id}?tab=assessments&view=assignments&assignmentId=${assignment.id}` })),
      ...section.quizzes.map((quiz): StudentTask => ({ ...shared, id: `quiz:${quiz.id}`, title: quiz.title, dueAt: quiz.closesAt, opensAt: quiz.opensAt, kind: "Exams / Quiz", submitted: quiz.attempts.some((attempt) => Boolean(attempt.submittedAt)), status: quizTaskStatus(quiz, quiz.attempts.length, quiz._count.questions, now), href: `/student/classes/${section.id}?tab=assessments&view=quizzes&quizId=${quiz.id}` })),
    ]
  })
  return groupStudentTasks(tasks, now)
}
