import type { ReactNode } from "react"

import { RoleSidebarNav } from "@/components/role-sidebar-nav"
import { getPrismaClient } from "@/lib/prisma"
import { requireAuth } from "@/modules/auth/permissions"
import { getOrganizationLogoUrl } from "@/modules/branding/organization-logo"
import { getConversationSidebarLinksForUser } from "@/modules/messages/data"

type SidebarLink = {
  href: string
  label: string
}

type RoleSidebarLayoutProps = {
  children: ReactNode
  description: string
  links: SidebarLink[]
  title: string
  tone: "instructor" | "student" | "parent"
}

const toneClasses = {
  instructor: {
    bg: "role-instructor-surface",
  },
  parent: {
    bg: "role-parent-surface",
  },
  student: {
    bg: "role-student-surface",
  },
} as const

export async function RoleSidebarLayout({
  children,
  description,
  links,
  title,
  tone,
}: RoleSidebarLayoutProps) {
  const user = await requireAuth()
  const toneClass = toneClasses[tone]
  const [classLinks, studentLinks, messageLinks, logoUrl] = await Promise.all([
    tone === "parent" ? [] : getRoleClassLinks(user.id, tone),
    tone === "parent" ? getParentSidebarLinks(user.id) : [],
    getConversationSidebarLinksForUser(user.id),
    getOrganizationLogoUrl(user.organizationId),
  ])
  const sectionLinks: SidebarLink[] = []

  return (
    <div className={`${toneClass.bg} flex flex-1 flex-col md:flex-row`}>
      <RoleSidebarNav
        classLinks={classLinks}
        description={description}
        links={[...links, ...studentLinks]}
        messageLinks={messageLinks}
        logoUrl={logoUrl}
        sectionLinks={sectionLinks}
        title={title}
        tone={tone}
        userEmail={user.email}
      />
      <section className="flex min-w-0 w-full flex-1 flex-col">
        {children}
      </section>
    </div>
  )
}

async function getRoleClassLinks(
  userId: string,
  tone: "instructor" | "student"
) {
  const prisma = getPrismaClient()

  if (tone === "instructor") {
    const sections = await prisma.classSection.findMany({
      where: {
        OR: [
          { instructors: { some: { instructorId: userId } } },
          { homeroom: { teacherId: userId } },
        ],
      },
      select: {
        id: true,
        name: true,
        course: { select: { title: true } },
        instructors: {
          select: {
            isPrimary: true,
            instructor: { select: { name: true, email: true } },
          },
          orderBy: [
            { isPrimary: "desc" },
            { instructor: { name: "asc" } },
          ],
        },
      },
      orderBy: { name: "asc" },
      take: 20,
    })

    return sections.map((section) => ({
      href: `/instructor/classes/${section.id}`,
      id: section.id,
      label: section.name,
      subLabel: formatClassSubLabel(section.course.title, section.instructors),
    }))
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: userId },
    select: {
      classSection: {
        select: {
          id: true,
          name: true,
          course: { select: { title: true } },
          instructors: {
            select: {
              isPrimary: true,
              instructor: { select: { name: true, email: true } },
            },
            orderBy: [
              { isPrimary: "desc" },
              { instructor: { name: "asc" } },
            ],
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
    take: 20,
  })

  return enrollments.map(({ classSection }) => ({
    href: `/student/classes/${classSection.id}`,
    id: classSection.id,
    label: classSection.name,
    subLabel: formatClassSubLabel(
      classSection.course.title,
      classSection.instructors
    ),
  }))
}

async function getParentSidebarLinks(parentId: string) {
  const relations = await getPrismaClient().parentStudentRelation.findMany({
    where: { parentId },
    select: { student: { select: { id: true, name: true } } },
    orderBy: [{ student: { name: "asc" } }, { studentId: "asc" }],
  })

  return relations.map(({ student }) => ({
    href: `/parent/students/${student.id}`,
    label: student.name,
  }))
}

function formatClassSubLabel(
  courseTitle: string,
  instructors: {
    instructor: { name: string | null; email: string | null }
  }[]
) {
  const instructorNames = instructors
    .map((item) => item.instructor.name ?? item.instructor.email)
    .filter((name): name is string => Boolean(name))

  return instructorNames.length
    ? `${courseTitle} · ${instructorNames.join(", ")}`
    : courseTitle
}
