import { BentoGrid } from "@/modules/dashboards/bento-grid"
import Link from "next/link"
import type { ReactNode } from "react"

import {
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

export const metadata = { title: "Instructor dashboard" }

export default async function InstructorPage() {
  const user = await requireAuth()
  const [{ classSections }, unreadMessages, unreadNotifications] = await Promise.all([
    getInstructorClasses(),
    getUnreadMessageCountForCurrentUser(),
    getUnreadNotificationCount(user.id),
  ])

  return (
    <DashboardPage
      userName={user.name ?? "there"}
      title="Instructor dashboard"
      description="Assigned class sections, learning activity, and teaching setup."
      tone="instructor"
    >
      <BentoGrid storageKey={`${user.id}:instructor`} widgets={[
        { id: "classes", title: "Classes", kind: "metric", w: 6, h: 4, accent: "blue", content: (<MetricCard
          description="Assigned to you"
          href="/instructor/classes"
          label="Classes"
          value={classSections.length}
        />) },
        { id: "messages", title: "Messages", kind: "metric", w: 6, h: 4, accent: "mint", content: (<MetricCard
          description="Direct and class conversations"
          href="/messages"
          label="Messages"
          tone={unreadMessages ? "attention" : "default"}
          value={unreadMessages ? `${unreadMessages} unread` : "Open"}
        />) },
        { id: "notifications", title: "Notifications", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          description="LMS activity alerts"
          href="/notifications"
          label="Notifications"
          tone={unreadNotifications ? "attention" : "default"}
          value={unreadNotifications ? `${unreadNotifications} unread` : "Open"}
        />) },
        { id: "class-enrollments", title: "Class enrollments", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          label="Class enrollments"
          value={classSections.reduce(
            (total, section) => total + section._count.enrollments,
            0
          )}
        />) },
        { id: "assignments-quizzes", title: "Assignments & quizzes", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          label="Assignments & quizzes"
          value={classSections.reduce(
            (total, section) =>
              total + section._count.assignments + section._count.quizzes,
            0
          )}
        />) },
        { id: "class-list", title: "Your classes", w: 12, h: 9, minW: 6, content: <InstructorClassTable classSections={classSections} /> },
      ]} />
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
      mobileRows={classSections.map((section) => ({
        id: section.id, title: section.name, href: `/instructor/classes/${section.id}`,
        fields: [
          { label: "Course", value: section.course.title },
          { label: "Term", value: section.term?.name ?? "No term" },
          { label: "Campus", value: section.campus?.name ?? "Organization-wide" },
          { label: "Students", value: section._count.enrollments },
        ],
      }))}
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
