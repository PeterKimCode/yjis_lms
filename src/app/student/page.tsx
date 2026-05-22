import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  ActionCard,
  ActionPanel,
  DashboardPage,
  MetricCard,
  OpenButton,
  SimpleTable,
  StatusBadge,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getStudentClasses } from "@/modules/dashboards/data"
import { getUnreadMessageCountForCurrentUser } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"
import { requireAuth } from "@/modules/auth/permissions"

export default async function StudentPage() {
  const authUser = await requireAuth()
  const [{ enrollments, user }, unreadMessages, unreadNotifications] = await Promise.all([
    getStudentClasses(),
    getUnreadMessageCountForCurrentUser(),
    getUnreadNotificationCount(authUser.id),
  ])
  const publishedGradeClassSections = enrollments.filter(
    (enrollment) => enrollment.classSection.finalGrades.length > 0
  )
  const termOptions = [
    ...new Map(
      publishedGradeClassSections
        .flatMap((enrollment) =>
          enrollment.classSection.finalGrades.map(
            (grade) => grade.termId ?? enrollment.classSection.term?.id ?? ""
          )
        )
        .filter(Boolean)
        .map((termId) => {
          const enrollment = enrollments.find(
            (item) => item.classSection.term?.id === termId
          )
          return enrollment?.classSection.term ?? null
        })
        .filter((term): term is NonNullable<typeof term> => Boolean(term))
        .map((term) => [term.id, term])
    ).values(),
  ]
  const hasPublishedDocuments = publishedGradeClassSections.length > 0

  return (
    <DashboardPage
      title="Student dashboard"
      description="Your enrolled classes, coursework, and learning progress."
      tone="student"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          description="Currently enrolled"
          href="/student/classes"
          label="Classes"
          value={enrollments.length}
        />
        <MetricCard
          description="Teachers and class groups"
          href="/messages"
          label="Messages"
          tone={unreadMessages ? "attention" : "default"}
          value={unreadMessages ? `${unreadMessages} unread` : "Open"}
        />
        <MetricCard
          description="Coursework and grade alerts"
          href="/notifications"
          label="Notifications"
          tone={unreadNotifications ? "attention" : "default"}
          value={unreadNotifications ? `${unreadNotifications} unread` : "Open"}
        />
        <MetricCard
          label="Lessons"
          value={enrollments.reduce(
            (total, item) => total + item.classSection._count.lessons,
            0
          )}
        />
        <MetricCard
          label="Assignments"
          value={enrollments.reduce(
            (total, item) => total + item.classSection._count.assignments,
            0
          )}
        />
      </div>
      <ActionPanel
        description="Your quickest paths for classwork and school updates."
        title="Student focus"
      >
        <ActionCard
          actionLabel="Open classes"
          badge={enrollments.length}
          description="Continue lessons, assignments, quizzes, boards, and grades."
          href="/student/classes"
          title="My classes"
        />
        <ActionCard
          actionLabel="Open inbox"
          badge={unreadMessages || undefined}
          description="Message teachers and follow class group conversations."
          href="/messages"
          title="Messages"
        />
        <ActionCard
          actionLabel="Review alerts"
          badge={unreadNotifications || undefined}
          description="See new assignments, quizzes, grades, and board activity."
          href="/notifications"
          title="Notifications"
        />
      </ActionPanel>
      <div className="rounded-lg border bg-background p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Download published or finalized report cards and transcripts.
          </p>
        </div>
        {hasPublishedDocuments ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/api/documents/transcript?studentId=${user.id}`}>
                Download transcript
              </Link>
            </Button>
            {termOptions.length ? (
              termOptions.map((term) => (
                <Button asChild key={term.id} size="sm" variant="outline">
                  <Link
                    href={`/api/documents/report-card?studentId=${user.id}&termId=${term.id}`}
                  >
                    Report card: {term.name}
                  </Link>
                </Button>
              ))
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href={`/api/documents/report-card?studentId=${user.id}`}>
                  Download report card
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No published documents available yet.
          </p>
        )}
      </div>
      <StudentClassTable enrollments={enrollments} />
    </DashboardPage>
  )
}

function StudentClassTable({
  enrollments,
}: {
  enrollments: Awaited<ReturnType<typeof getStudentClasses>>["enrollments"]
}) {
  return (
    <SimpleTable
      empty="No enrolled class sections yet."
      headers={["Class", "Course", "Term", "Campus", "Status", "Open"]}
      rows={enrollments.map((enrollment) => (
        <TableRow key={enrollment.id}>
          <TableCell className="font-medium">
            {enrollment.classSection.name}
          </TableCell>
          <TableCell>{enrollment.classSection.course.title}</TableCell>
          <TableCell>{enrollment.classSection.term?.name ?? "No term"}</TableCell>
          <TableCell>
            {enrollment.classSection.campus?.name ?? "Organization-wide"}
          </TableCell>
          <TableCell>
            <StatusBadge value={enrollment.status} />
          </TableCell>
          <TableCell>
            <OpenButton href={`/student/classes/${enrollment.classSectionId}`} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}
