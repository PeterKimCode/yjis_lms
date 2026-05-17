import { UserRole } from "@prisma/client"

import { requireAnyRole } from "@/modules/auth/permissions"
import { ClassSectionDetail } from "@/modules/dashboards/class-detail"

export default async function InstructorClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classSectionId: string }>
  searchParams: Promise<{ lessonId?: string }>
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
  const selectedLessonId = (await searchParams).lessonId

  return (
    <ClassSectionDetail
      classSectionId={classSectionId}
      mode="instructor"
      selectedLessonId={selectedLessonId}
      userId={user.id}
    />
  )
}
