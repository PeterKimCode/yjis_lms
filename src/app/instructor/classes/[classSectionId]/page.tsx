import { UserRole } from "@prisma/client"

import { requireAnyRole } from "@/modules/auth/permissions"
import { ClassSectionDetail } from "@/modules/dashboards/class-detail"

export default async function InstructorClassDetailPage({
  params,
}: {
  params: Promise<{ classSectionId: string }>
}) {
  const user = await requireAnyRole([UserRole.INSTRUCTOR, UserRole.HOMEROOM_TEACHER])
  const { classSectionId } = await params

  return (
    <ClassSectionDetail
      classSectionId={classSectionId}
      mode="instructor"
      userId={user.id}
    />
  )
}
