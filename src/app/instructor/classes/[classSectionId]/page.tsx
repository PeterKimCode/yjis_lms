import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"

import { requireAnyRole } from "@/modules/auth/permissions"
import { ClassSectionDetail } from "@/modules/dashboards/class-detail"
import { instructorClassHref, resolveInstructorClassSelection } from "@/modules/dashboards/instructor-class-navigation"

export default async function InstructorClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classSectionId: string }>
  searchParams: Promise<{ lessonId?: string; tab?: string | string[]; view?: string | string[] }>
}) {
  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const { classSectionId } = await params
  const query = await searchParams
  const selectedLessonId = typeof query.lessonId === "string" ? query.lessonId : undefined
  const selection = resolveInstructorClassSelection(query.tab, query.view)
  if ((query.tab !== undefined && query.tab !== selection.tab) ||
      (query.view !== undefined && query.view !== selection.view)) {
    redirect(instructorClassHref(classSectionId, selection, selectedLessonId))
  }

  return (
    <ClassSectionDetail
      classSectionId={classSectionId}
      mode="instructor"
      instructorSelection={selection}
      selectedLessonId={selectedLessonId}
      userId={user.id}
    />
  )
}
