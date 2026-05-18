import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  DashboardPage,
  MetricCard,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getStudentClasses } from "@/modules/dashboards/data"
import { getUnreadMessageCountForCurrentUser } from "@/modules/messages/data"

export default async function StudentPage() {
  const [{ enrollments, user }, unreadMessages] = await Promise.all([
    getStudentClasses(),
    getUnreadMessageCountForCurrentUser(),
  ])
  const termOptions = [
    ...new Map(
      enrollments
        .map((enrollment) => enrollment.classSection.term)
        .filter((term): term is NonNullable<typeof term> => Boolean(term))
        .map((term) => [term.id, term])
    ).values(),
  ]

  return (
    <DashboardPage
      title="Student dashboard"
      description="Your enrolled classes, coursework, and learning progress."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard href="/student/classes" label="Classes" value={enrollments.length} />
        <MetricCard
          href="/messages"
          label="Messages"
          value={unreadMessages ? `${unreadMessages} unread` : "Open"}
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
      <div className="rounded-lg border bg-background p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Download published or finalized report cards and transcripts.
          </p>
        </div>
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
          <TableCell>{enrollment.status}</TableCell>
          <TableCell>
            <OpenButton href={`/student/classes/${enrollment.classSectionId}`} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}
