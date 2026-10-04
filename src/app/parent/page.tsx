import { BentoGrid } from "@/modules/dashboards/bento-grid"
import {
  DashboardPage,
  MetricCard,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getParentStudents } from "@/modules/dashboards/data"
import { getUnreadMessageCountForCurrentUser } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"
import { requireAuth } from "@/modules/auth/permissions"
import { getPrismaClient } from "@/lib/prisma"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { assessmentAvailability } from "@/modules/quizzes/availability"
import { getQuizAttemptStatus } from "@/modules/quizzes/status"

export const metadata = { title: "Parent dashboard" }

export default async function ParentPage() {
  const user = await requireAuth()
  const [{ relations }, unreadMessages, unreadNotifications] = await Promise.all([
    getParentStudents(),
    getUnreadMessageCountForCurrentUser(),
    getUnreadNotificationCount(user.id),
  ])
  const studentIds = relations.map((relation) => relation.student.id)
  const exams = studentIds.length ? await getPrismaClient().quiz.findMany({
    where: { isPublished: true, archivedAt: null, classSection: { enrollments: { some: { studentId: { in: studentIds }, status: "ENROLLED" } } } },
    select: {
      id: true, title: true, isPublished: true, opensAt: true, closesAt: true, maxAttempts: true,
      classSectionId: true, classSection: { select: { name: true, organization: { select: { timezone: true } } } },
      _count: { select: { questions: true } },
      attempts: { where: { studentId: { in: studentIds } }, orderBy: { createdAt: "desc" }, select: { studentId: true, submittedAt: true, score: true, answers: { select: { score: true, question: { select: { type: true } } } } } },
    }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10,
  }) : []

  return (
    <DashboardPage
      userName={user.name ?? "there"}
      title="Parent dashboard"
      description="Linked students and their current learning activity."
      tone="parent"
    >
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Exams / Quiz · latest published</h2>
        <SimpleTable empty="No published exams or quizzes yet." headers={["Exams / Quiz", "Student / Class", "Starts", "Ends", "Time zone", "Status", "Open"]} rows={exams.flatMap((exam) => relations.filter((relation) => relation.student.enrollments.some((enrollment) => enrollment.classSectionId === exam.classSectionId && enrollment.status === "ENROLLED")).map((relation) => {
          const attempts = exam.attempts.filter((attempt) => attempt.studentId === relation.student.id)
          const zone = exam.classSection.organization.timezone || "Asia/Seoul"
          return <TableRow key={`${exam.id}:${relation.student.id}`}><TableCell className="font-medium">{exam.title}</TableCell><TableCell>{relation.student.name} · {exam.classSection.name}</TableCell><TableCell>{formatDateTimeInTimeZone(exam.opensAt, zone)}</TableCell><TableCell>{formatDateTimeInTimeZone(exam.closesAt, zone)}</TableCell><TableCell>{zone}</TableCell><TableCell>{attempts[0] ? getQuizAttemptStatus(attempts[0]) : assessmentAvailability(exam, attempts.length, exam._count.questions)}</TableCell><TableCell><OpenButton href={`/parent/students/${relation.student.id}/classes/${exam.classSectionId}?tab=assessments&view=quizzes`} /></TableCell></TableRow>
        }))} />
      </section>
      <BentoGrid storageKey={`${user.id}:parent`} widgets={[
        { id: "students", title: "Students", kind: "metric", w: 6, h: 4, accent: "blue", content: (<MetricCard
          description="Linked to your account"
          href="/parent/students"
          label="Students"
          value={relations.length}
        />) },
        { id: "messages", title: "Messages", kind: "metric", w: 6, h: 4, accent: "mint", content: (<MetricCard
          description="Teacher conversations"
          href="/messages"
          label="Messages"
          tone={unreadMessages ? "attention" : "default"}
          value={unreadMessages ? `${unreadMessages} unread` : "Open"}
        />) },
        { id: "notifications", title: "Notifications", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          description="Student activity alerts"
          href="/notifications"
          label="Notifications"
          tone={unreadNotifications ? "attention" : "default"}
          value={unreadNotifications ? `${unreadNotifications} unread` : "Open"}
        />) },
        { id: "classes", title: "Classes", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          label="Classes"
          value={relations.reduce(
            (total, relation) => total + relation.student.enrollments.length,
            0
          )}
        />) },
        { id: "primary-links", title: "Primary links", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          label="Primary links"
          value={relations.filter((relation) => relation.isPrimary).length}
        />) },
        { id: "student-list", title: "Linked students", w: 12, h: 9, minW: 6, content: <ParentStudentsTable relations={relations} /> },
      ]} />
    </DashboardPage>
  )
}

function ParentStudentsTable({
  relations,
}: {
  relations: Awaited<ReturnType<typeof getParentStudents>>["relations"]
}) {
  return (
    <SimpleTable
      empty="No linked students yet."
      headers={["Student", "Grade", "Campus", "Classes", "Open"]}
      rows={relations.map((relation) => (
        <TableRow key={relation.id}>
          <TableCell className="font-medium">{relation.student.name}</TableCell>
          <TableCell>
            {relation.student.studentProfile?.currentGradeLevel?.name ?? "-"}
          </TableCell>
          <TableCell>
            {relation.student.studentProfile?.campus?.name ?? "Organization-wide"}
          </TableCell>
          <TableCell>{relation.student.enrollments.length}</TableCell>
          <TableCell>
            <OpenButton href={`/parent/students/${relation.studentId}`} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}
