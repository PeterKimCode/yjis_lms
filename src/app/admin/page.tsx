import Link from "next/link"
import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPrismaClient } from "@/lib/prisma"
import {
  getAcademicYearWhereForAdmin,
  getCampusWhereForAdmin,
  getClassSectionWhereForAdmin,
  getCourseWhereForAdmin,
  getUserWhereForAdmin,
  isSuperAdmin,
} from "@/modules/admin/access"
import { getAdminData } from "@/modules/admin/data"
import { AdminLinkGrid, AdminPageHeader } from "@/modules/admin/components"
import { getUnreadMessageCount } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"
import { ActionCard, ActionPanel } from "@/modules/dashboards/components"

export default async function AdminPage() {
  const admin = await getAdminData()
  const prisma = getPrismaClient()
  const [
    campusCount,
    yearCount,
    courseCount,
    classSectionCount,
    userCount,
    unreadMessages,
    unreadNotifications,
    organizationCards,
  ] = await Promise.all([
    prisma.campus.count({ where: getCampusWhereForAdmin(admin.user) }),
    prisma.academicYear.count({
      where: getAcademicYearWhereForAdmin(admin.user),
    }),
    prisma.course.count({ where: getCourseWhereForAdmin(admin.user) }),
    prisma.classSection.count({
      where: getClassSectionWhereForAdmin(admin.user),
    }),
    prisma.user.count({ where: getUserWhereForAdmin(admin.user) }),
    getUnreadMessageCount(admin.user.id),
    getUnreadNotificationCount(admin.user.id),
    isSuperAdmin(admin.user)
      ? prisma.organization.findMany({
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            _count: {
              select: {
                campuses: true,
                users: true,
                courses: true,
                classSections: true,
                fileAssets: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ])

  const metrics = [
    ["Organizations", admin.organizations.length, "/admin/organizations"],
    ["Campuses", campusCount, "/admin/campuses"],
    ["Academic Years", yearCount, "/admin/academic-years"],
    ["Courses", courseCount, "/admin/courses"],
    ["Class Sections", classSectionCount, "/admin/class-sections"],
    ["Users", userCount, "/admin/users"],
    ["Messages", unreadMessages ? `${unreadMessages} unread` : "Open", "/messages"],
    [
      "Notifications",
      unreadNotifications ? `${unreadNotifications} unread` : "Open",
      "/notifications",
    ],
  ] as const

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin overview"
        description="Start with academic years, terms, courses, and class sections."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value, href]) => (
          <Link href={href} key={label}>
            <Card className="lms-card lms-card-hover">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {value}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {organizationCards.length ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Organizations</h2>
            <p className="text-sm text-muted-foreground">
              Open an organization-scoped workspace for users, courses, class
              sections, and files.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {organizationCards.map((organization) => (
              <Card className="lms-card" key={organization.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {organization.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {organization.slug}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <OrgMetric
                      label="Campuses"
                      value={organization._count.campuses}
                    />
                    <OrgMetric label="Users" value={organization._count.users} />
                    <OrgMetric
                      label="Courses"
                      value={organization._count.courses}
                    />
                    <OrgMetric
                      label="Classes"
                      value={organization._count.classSections}
                    />
                    <OrgMetric
                      label="Files"
                      value={organization._count.fileAssets}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <OrgLink href={`/admin/users?organizationId=${organization.id}`}>
                      Users
                    </OrgLink>
                    <OrgLink href={`/admin/courses?organizationId=${organization.id}`}>
                      Courses
                    </OrgLink>
                    <OrgLink
                      href={`/admin/class-sections?organizationId=${organization.id}`}
                    >
                      Classes
                    </OrgLink>
                    <OrgLink href={`/admin/files?organizationId=${organization.id}`}>
                      Files
                    </OrgLink>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
      <ActionPanel
        description="Common admin workflows and activity queues."
        title="Admin focus"
      >
        <ActionCard
          actionLabel="Manage users"
          badge={userCount}
          description="Review students, parents, instructors, roles, and academic records."
          href="/admin/users"
          title="Users and student records"
        />
        <ActionCard
          actionLabel="Open inbox"
          badge={unreadMessages || undefined}
          description="Read and respond to school conversations."
          href="/messages"
          title="Messages"
        />
        <ActionCard
          actionLabel="Review alerts"
          badge={unreadNotifications || undefined}
          description="See new submissions, board activity, grades, and system notices."
          href="/notifications"
          title="Notifications"
        />
      </ActionPanel>
      <AdminLinkGrid />
    </div>
  )
}

function OrgMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white/70 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function OrgLink({
  children,
  href,
}: {
  children: ReactNode
  href: string
}) {
  return (
    <Link
      className="rounded-md border bg-background px-3 py-1.5 font-medium text-primary hover:bg-primary/5"
      href={href}
    >
      {children}
    </Link>
  )
}
