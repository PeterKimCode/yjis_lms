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
  const [classLinks, messageLinks, logoUrl] = await Promise.all([
    getRoleClassLinks(user.id, tone),
    getConversationSidebarLinksForUser(user.id),
    getOrganizationLogoUrl(user.organizationId),
  ])
  const sectionLinks = getClassSectionAnchorLinks(tone)

  return (
    <div className={`${toneClass.bg} flex flex-1`}>
      <RoleSidebarNav
        classLinks={classLinks}
        description={description}
        links={links}
        messageLinks={messageLinks}
        logoUrl={logoUrl}
        sectionLinks={sectionLinks}
        title={title}
        tone={tone}
        userEmail={user.email}
      />
      <section className="flex min-w-0 flex-1 flex-col">
        {children}
      </section>
    </div>
  )
}

async function getRoleClassLinks(
  userId: string,
  tone: "instructor" | "student" | "parent"
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

  if (tone === "student") {
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

  const relations = await prisma.parentStudentRelation.findMany({
    where: { parentId: userId },
    select: {
      student: {
        select: {
          id: true,
          name: true,
          enrollments: {
            select: {
              classSection: {
                select: {
                  id: true,
                  name: true,
                  course: { select: { title: true } },
                },
              },
            },
            take: 10,
          },
        },
      },
    },
    take: 10,
  })

  return relations.flatMap((relation) =>
    relation.student.enrollments.map(({ classSection }) => ({
      href: `/parent/students/${relation.student.id}`,
      id: `${relation.student.id}-${classSection.id}`,
      label: classSection.name,
      subLabel: `${relation.student.name ?? "Linked student"} · ${classSection.course.title}`,
    }))
  )
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

function getClassSectionAnchorLinks(tone: "instructor" | "student" | "parent") {
  if (tone === "parent") return []

  return [
    { href: "#lessons", label: "Lessons" },
    { href: "#sessions", label: "Sessions" },
    { href: "#attendance", label: "Attendance" },
    { href: "#assignments", label: "Assignments" },
    { href: "#quizzes", label: "Quizzes" },
    { href: "#exams", label: "Exams" },
    { href: "#grades", label: "Grades" },
    { href: "#boards", label: "Boards" },
  ]
}
