import {
  ActionCard,
  ActionPanel,
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

export default async function ParentPage() {
  const user = await requireAuth()
  const [{ relations }, unreadMessages, unreadNotifications] = await Promise.all([
    getParentStudents(),
    getUnreadMessageCountForCurrentUser(),
    getUnreadNotificationCount(user.id),
  ])

  return (
    <DashboardPage
      title="Parent dashboard"
      description="Linked students and their current learning activity."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          description="Linked to your account"
          href="/parent/students"
          label="Students"
          value={relations.length}
        />
        <MetricCard
          description="Teacher conversations"
          href="/messages"
          label="Messages"
          tone={unreadMessages ? "attention" : "default"}
          value={unreadMessages ? `${unreadMessages} unread` : "Open"}
        />
        <MetricCard
          description="Student activity alerts"
          href="/notifications"
          label="Notifications"
          tone={unreadNotifications ? "attention" : "default"}
          value={unreadNotifications ? `${unreadNotifications} unread` : "Open"}
        />
        <MetricCard
          label="Classes"
          value={relations.reduce(
            (total, relation) => total + relation.student.enrollments.length,
            0
          )}
        />
        <MetricCard
          label="Primary links"
          value={relations.filter((relation) => relation.isPrimary).length}
        />
      </div>
      <ActionPanel
        description="Follow each linked student's class activity from one place."
        title="Parent focus"
      >
        <ActionCard
          actionLabel="View students"
          badge={relations.length}
          description="Open linked student profiles, classes, documents, and progress."
          href="/parent/students"
          title="Linked students"
        />
        <ActionCard
          actionLabel="Open inbox"
          badge={unreadMessages || undefined}
          description="Continue parent-teacher conversations."
          href="/messages"
          title="Messages"
        />
        <ActionCard
          actionLabel="Review alerts"
          badge={unreadNotifications || undefined}
          description="See class, assignment, grade, and document updates."
          href="/notifications"
          title="Notifications"
        />
      </ActionPanel>
      <ParentStudentsTable relations={relations} />
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
