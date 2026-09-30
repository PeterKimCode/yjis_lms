import { UserRole } from "@prisma/client"

import { requireAnyRole } from "@/modules/auth/permissions"
import { resolveInstructorClassSelection } from "@/modules/dashboards/instructor-class-navigation"
import { ClassSectionDetail } from "@/modules/dashboards/class-detail"

export default async function StudentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classSectionId: string }>
  searchParams: Promise<{ tab?: string | string[]; view?: string | string[] }>
}) {
  const user = await requireAnyRole([UserRole.STUDENT])
  const { classSectionId } = await params

  const query = await searchParams

  return (
    <ClassSectionDetail
      classSectionId={classSectionId}
      mode="student"
      instructorSelection={resolveInstructorClassSelection(query.tab, query.view)}
      userId={user.id}
    />
  )
}
