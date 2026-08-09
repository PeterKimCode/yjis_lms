import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import { Prisma, UserRole } from "@prisma/client"

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
import { AdminPageHeader } from "@/modules/admin/components"
import { getUnreadMessageCount } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"
import { ActionCard, ActionPanel } from "@/modules/dashboards/components"

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>
}) {
  const admin = await getAdminData()
  const params = await searchParams
  const prisma = getPrismaClient()
  const canFilterOrganizations = isSuperAdmin(admin.user)
  const organizationCards = canFilterOrganizations
    ? await prisma.organization.findMany({
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
    : []
  const organizationLogoRows = organizationCards.length
    ? await prisma.$queryRaw<
        Array<{ id: string; logoFileAssetId: string | null }>
      >`
        SELECT "id", "logoFileAssetId"
        FROM "Organization"
        WHERE "id" IN (${Prisma.join(organizationCards.map((organization) => organization.id))})
      `
    : []
  const roleRows = organizationCards.length
    ? await prisma.userRoleAssignment.groupBy({
        by: ["organizationId", "role"],
        where: {
          organizationId: {
            in: organizationCards.map((organization) => organization.id),
          },
        },
        _count: {
          userId: true,
        },
      })
    : []
  const logoByOrganizationId = new Map(
    organizationLogoRows.map((row) => [row.id, row.logoFileAssetId])
  )
  const roleCountsByOrganizationId = new Map<string, Map<UserRole, number>>()
  for (const row of roleRows) {
    const organizationRoles =
      roleCountsByOrganizationId.get(row.organizationId) ??
      new Map<UserRole, number>()
    organizationRoles.set(row.role, row._count.userId)
    roleCountsByOrganizationId.set(row.organizationId, organizationRoles)
  }
  const selectedOrganizationId =
    organizationCards.find(
      (organization) => organization.id === params.organizationId?.trim()
    )?.id ?? ""
  const selectedOrganization = organizationCards.find(
    (organization) => organization.id === selectedOrganizationId
  )
  const organizationFilter = selectedOrganizationId
    ? { organizationId: selectedOrganizationId }
    : {}
  const [
    campusCount,
    yearCount,
    courseCount,
    classSectionCount,
    userCount,
    unreadMessages,
    unreadNotifications,
  ] = await Promise.all([
    prisma.campus.count({
      where: {
        AND: [getCampusWhereForAdmin(admin.user), organizationFilter],
      },
    }),
    prisma.academicYear.count({
      where: {
        AND: [getAcademicYearWhereForAdmin(admin.user), organizationFilter],
      },
    }),
    prisma.course.count({
      where: {
        AND: [getCourseWhereForAdmin(admin.user), organizationFilter],
      },
    }),
    prisma.classSection.count({
      where: {
        AND: [getClassSectionWhereForAdmin(admin.user), organizationFilter],
      },
    }),
    prisma.user.count({
      where: {
        AND: [getUserWhereForAdmin(admin.user), organizationFilter],
      },
    }),
    getUnreadMessageCount(admin.user.id),
    getUnreadNotificationCount(admin.user.id),
  ])
  const organizationQuery = selectedOrganizationId
    ? `?organizationId=${selectedOrganizationId}`
    : ""

  const metrics = [
    [
      "Organizations",
      selectedOrganization ? 1 : admin.organizations.length,
      `/admin/organizations${organizationQuery}`,
    ],
    ["Campuses", campusCount, `/admin/campuses${organizationQuery}`],
    ["Academic Years", yearCount, `/admin/academic-years${organizationQuery}`],
    ["Courses", courseCount, `/admin/courses${organizationQuery}`],
    ["Class Sections", classSectionCount, `/admin/class-sections${organizationQuery}`],
    ["Users", userCount, `/admin/users${organizationQuery}`],
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
      {selectedOrganization ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <span className="font-medium text-primary">
            Viewing: {selectedOrganization.name}
          </span>
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/admin"
          >
            Reset organization
          </Link>
        </div>
      ) : null}
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
      {organizationCards.length ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Organizations</h2>
            <p className="text-sm text-muted-foreground">
              Choose an organization card to filter this dashboard and related
              admin pages.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {organizationCards.map((organization) => {
              const isSelected = organization.id === selectedOrganizationId
              const roleCounts =
                roleCountsByOrganizationId.get(organization.id) ??
                new Map<UserRole, number>()
              const logoFileAssetId = logoByOrganizationId.get(organization.id)
              const logoUrl = logoFileAssetId
                ? `/api/files/${logoFileAssetId}/download?disposition=inline`
                : "/brand/gtcc-logo.png"

              return (
                <Card
                  className={`lms-card lms-card-hover ${
                    isSelected ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                  key={organization.id}
                >
                  <Link
                    className="block rounded-lg p-1 transition-colors hover:bg-primary/5"
                    href={`/admin?organizationId=${organization.id}`}
                  >
                    <div className="flex min-w-0 items-center gap-3 px-3 py-3">
                      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border bg-white">
                        <Image
                          alt={`${organization.name} logo`}
                          className="h-full w-full object-contain"
                          height={56}
                          src={logoUrl}
                          width={56}
                          unoptimized={Boolean(logoFileAssetId)}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base">
                          {organization.name}
                        </CardTitle>
                        <p className="truncate text-xs text-muted-foreground">
                          {organization.slug}
                        </p>
                      </span>
                    </div>
                  </Link>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <OrgMetric
                        href={`/admin/campuses?organizationId=${organization.id}`}
                        label="Campuses"
                        value={organization._count.campuses}
                      />
                      <OrgMetric
                        href={`/admin/users?organizationId=${organization.id}`}
                        label="Users"
                        value={organization._count.users}
                      />
                      <OrgMetric
                        href={`/admin/courses?organizationId=${organization.id}`}
                        label="Courses"
                        value={organization._count.courses}
                      />
                      <OrgMetric
                        href={`/admin/class-sections?organizationId=${organization.id}`}
                        label="Classes"
                        value={organization._count.classSections}
                      />
                      <OrgMetric
                        href={`/admin/files?organizationId=${organization.id}`}
                        label="Files"
                        value={organization._count.fileAssets}
                      />
                    </div>
                    <div className="rounded-lg border bg-white/70 p-2">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Users by role
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {organizationRoleLabels.map(([role, label]) => (
                          <OrgMetric
                            compact
                            href={`/admin/users?organizationId=${organization.id}&role=${role}`}
                            key={role}
                            label={label}
                            value={roleCounts.get(role) ?? 0}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <OrgLink href={`/admin/users?organizationId=${organization.id}`}>
                        Users
                      </OrgLink>
                      <OrgLink
                        href={`/admin/organizations?organizationId=${organization.id}`}
                      >
                        Organization
                      </OrgLink>
                      <OrgLink
                        href={`/admin/campuses?organizationId=${organization.id}`}
                      >
                        Campuses
                      </OrgLink>
                      <OrgLink
                        href={`/admin/academic-years?organizationId=${organization.id}`}
                      >
                        Years
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
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

const organizationRoleLabels: Array<[UserRole, string]> = [
  [UserRole.SUPER_ADMIN, "Super admin"],
  [UserRole.ORG_ADMIN, "Org admin"],
  [UserRole.SCHOOL_ADMIN, "School admin"],
  [UserRole.ACADEMIC_STAFF, "Staff"],
  [UserRole.INSTRUCTOR, "Instructor"],
  [UserRole.HOMEROOM_TEACHER, "Homeroom"],
  [UserRole.STUDENT, "Student"],
  [UserRole.PARENT, "Parent"],
]

function OrgMetric({
  compact = false,
  href,
  label,
  value,
}: {
  compact?: boolean
  href: string
  label: string
  value: number
}) {
  return (
    <Link
      className={`rounded-lg border bg-white/70 p-2 transition-colors hover:border-primary/50 hover:bg-primary/5 ${
        compact ? "flex items-center justify-between gap-2" : "block"
      }`}
      href={href}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={compact ? "text-sm font-semibold" : "text-lg font-semibold"}>
        {value}
      </p>
    </Link>
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
