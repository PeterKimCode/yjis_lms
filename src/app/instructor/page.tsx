import Link from "next/link"
import type { ReactNode } from "react"

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
import { getInstructorClasses } from "@/modules/dashboards/data"
import { getUnreadMessageCountForCurrentUser } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"
import { requireAuth } from "@/modules/auth/permissions"

export default async function InstructorPage() {
  const user = await requireAuth()
  const [{ classSections }, unreadMessages, unreadNotifications] = await Promise.all([
    getInstructorClasses(),
    getUnreadMessageCountForCurrentUser(),
    getUnreadNotificationCount(user.id),
  ])

  return (
    <DashboardPage
      title="Instructor dashboard"
      description="Assigned class sections, learning activity, and teaching setup."
      tone="instructor"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          description="Assigned to you"
          href="/instructor/classes"
          label="Classes"
          value={classSections.length}
        />
        <MetricCard
          description="Direct and class conversations"
          href="/messages"
          label="Messages"
          tone={unreadMessages ? "attention" : "default"}
          value={unreadMessages ? `${unreadMessages} unread` : "Open"}
        />
        <MetricCard
          description="LMS activity alerts"
          href="/notifications"
          label="Notifications"
          tone={unreadNotifications ? "attention" : "default"}
          value={unreadNotifications ? `${unreadNotifications} unread` : "Open"}
        />
        <MetricCard
          label="Students"
          value={classSections.reduce(
            (total, section) => total + section._count.enrollments,
            0
          )}
        />
        <MetricCard
          label="Open coursework"
          value={classSections.reduce(
            (total, section) =>
              total + section._count.assignments + section._count.quizzes,
            0
          )}
        />
      </div>
      <ActionPanel
        description="Jump straight into the highest-frequency teaching tasks."
        title="Teaching focus"
      >
        <ActionCard
          actionLabel="Review classes"
          badge={classSections.length}
          description="Open lessons, attendance, assignments, quizzes, boards, and grades."
          href="/instructor/classes"
          title="Class management"
        />
        <ActionCard
          actionLabel="Open inbox"
          badge={unreadMessages || undefined}
          description="Reply to student, parent, and class group messages."
          href="/messages"
          title="Messages"
        />
        <ActionCard
          actionLabel="Review alerts"
          badge={unreadNotifications || undefined}
          description="See new submissions, board activity, grades, and system updates."
          href="/notifications"
          title="Notifications"
        />
      </ActionPanel>
      <InstructorClassTable classSections={classSections} />
    </DashboardPage>
  )
}

function InstructorClassTable({
  classSections,
}: {
  classSections: Awaited<ReturnType<typeof getInstructorClasses>>["classSections"]
}) {
  return (
    <SimpleTable
      empty="No assigned class sections yet."
      headers={["Class", "Course", "Term", "Campus", "Students", "Open"]}
      rows={classSections.map((section) => (
        <TableRow key={section.id}>
          <LinkedCell
            className="font-medium"
            href={`/instructor/classes/${section.id}`}
          >
            {section.name}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section.course.title}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section.term?.name ?? "No term"}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section.campus?.name ?? "Organization-wide"}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section._count.enrollments}
          </LinkedCell>
          <TableCell>
            <OpenButton href={`/instructor/classes/${section.id}`} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}

function LinkedCell({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <TableCell className={className}>
      <Link className="-m-3 block p-3 hover:text-primary" href={href}>
        {children}
      </Link>
    </TableCell>
  )
}
