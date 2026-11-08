import { HelpTooltip } from "@/components/help-tooltip"
import { BentoGrid } from "@/modules/dashboards/bento-grid"
import Link from "next/link"
import type { ReactNode } from "react"

import {
  DashboardPage,
  MetricCard,
  OpenButton,
  SimpleTable,
  StatusBadge,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getStudentClasses } from "@/modules/dashboards/data"
import { StudentDocuments } from "@/modules/documents/student-documents"
import { getUnreadMessageCountForCurrentUser } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"
import { requireAuth } from "@/modules/auth/permissions"
import { getStudentTaskGroups } from "@/modules/dashboards/student-task-data"
import { StudentTaskPanel } from "@/modules/dashboards/student-task-panel"

export const metadata = { title: "Student dashboard" }

export default async function StudentPage() {
  const authUser = await requireAuth()
  const [{ enrollments, user }, unreadMessages, unreadNotifications] = await Promise.all([
    getStudentClasses(),
    getUnreadMessageCountForCurrentUser(),
    getUnreadNotificationCount(authUser.id),
  ])
  const tasks = await getStudentTaskGroups(user.id)

  return (
    <DashboardPage
      userName={authUser.name ?? "there"}
      title="Student dashboard"
      description="Your enrolled classes, coursework, and learning progress."
      tone="student"
    >
      <StudentTaskPanel groups={tasks} />
      <BentoGrid storageKey={`${authUser.id}:student`} widgets={[
        { id: "classes", title: "Classes", kind: "metric", w: 6, h: 4, accent: "blue", content: (<MetricCard
          description="Currently enrolled"
          href="/student/classes"
          label="Classes"
          value={enrollments.filter((item) => item.status === "ENROLLED").length}
        />) },
        { id: "messages", title: "Messages", kind: "metric", w: 6, h: 4, accent: "mint", content: (<MetricCard
          description="Teachers and class groups"
          href="/messages"
          label="Messages"
          tone={unreadMessages ? "attention" : "default"}
          value={unreadMessages ? `${unreadMessages} unread` : "Open"}
        />) },
        { id: "notifications", title: "Notifications", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          description="Coursework and grade alerts"
          href="/notifications"
          label="Notifications"
          tone={unreadNotifications ? "attention" : "default"}
          value={unreadNotifications ? `${unreadNotifications} unread` : "Open"}
        />) },
        { id: "lessons", title: "Lessons", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          label="Lessons"
          value={enrollments.reduce(
            (total, item) => total + item.classSection._count.lessons,
            0
          )}
        />) },
        { id: "assignments", title: "Assignments", kind: "metric", w: 4, h: 4, accent: "neutral", content: (<MetricCard
          label="Assignments"
          value={enrollments.reduce(
            (total, item) => total + item.classSection._count.assignments,
            0
          )}
        />) },
        { id: "class-list", title: "Your classes", w: 8, h: 9, minW: 6, content: <StudentClassTable enrollments={enrollments} /> },
        { id: "documents", title: "Documents", help: <HelpTooltip>Request official grade documents from your school and download approved PDFs.</HelpTooltip>, w: 4, h: 9, content: <StudentDocuments studentId={user.id} canRequest /> },
      ]} />
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
      headers={["Class", "Course", "Instructor", "Term", "Campus", "Status", "Open"]}
      mobileRows={enrollments.map((enrollment) => ({
        id: enrollment.id, title: enrollment.classSection.name, href: `/student/classes/${enrollment.classSectionId}`,
        fields: [
          { label: "Course", value: enrollment.classSection.course.title },
          { label: "Instructor", value: formatInstructors(enrollment.classSection.instructors) },
          { label: "Term", value: enrollment.classSection.term?.name ?? "No term" },
          { label: "Campus", value: enrollment.classSection.campus?.name ?? "Organization-wide" },
          { label: "Status", value: <StatusBadge value={enrollment.status} /> },
        ],
      }))}
      rows={enrollments.map((enrollment) => (
        <TableRow key={enrollment.id}>
          <LinkedCell
            className="font-medium"
            href={`/student/classes/${enrollment.classSectionId}`}
          >
            {enrollment.classSection.name}
          </LinkedCell>
          <LinkedCell href={`/student/classes/${enrollment.classSectionId}`}>
            {enrollment.classSection.course.title}
          </LinkedCell>
          <LinkedCell href={`/student/classes/${enrollment.classSectionId}`}>
            {formatInstructors(enrollment.classSection.instructors)}
          </LinkedCell>
          <LinkedCell href={`/student/classes/${enrollment.classSectionId}`}>
            {enrollment.classSection.term?.name ?? "No term"}
          </LinkedCell>
          <LinkedCell href={`/student/classes/${enrollment.classSectionId}`}>
            {enrollment.classSection.campus?.name ?? "Organization-wide"}
          </LinkedCell>
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

function formatInstructors(
  instructors: Awaited<
    ReturnType<typeof getStudentClasses>
  >["enrollments"][number]["classSection"]["instructors"]
) {
  const names = instructors
    .map((item) => item.instructor.name ?? item.instructor.email)
    .filter((name): name is string => Boolean(name))

  return names.length ? names.join(", ") : "-"
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
