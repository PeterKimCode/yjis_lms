import { UserRole } from "@prisma/client"

import { requireAnyRole } from "@/modules/auth/permissions"
import { ClassSectionDetail } from "@/modules/dashboards/class-detail"

export default async function StudentClassDetailPage({
  params,
}: {
  params: Promise<{ classSectionId: string }>
}) {
  const user = await requireAnyRole([UserRole.STUDENT])
  const { classSectionId } = await params

  return <ClassSectionDetail classSectionId={classSectionId} userId={user.id} />
}
