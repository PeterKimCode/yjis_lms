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

export const metadata = { title: "Parent dashboard" }

export default async function ParentPage() {
  const user = await requireAuth()
  const [{ relations }, unreadMessages, unreadNotifications] = await Promise.all([
    getParentStudents(),
    getUnreadMessageCountForCurrentUser(),
    getUnreadNotificationCount(user.id),
  ])

  return (
    <DashboardPage
      userName={user.name ?? "there"}
      title="Parent dashboard"
      description="Linked students and their current learning activity."
      tone="parent"
    >
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
