import { FinalGradeStatus } from "@prisma/client"

export function isGradeVisibleToStudents(status: FinalGradeStatus | string) {
  return (
    status === FinalGradeStatus.PUBLISHED ||
    status === FinalGradeStatus.FINALIZED
  )
}
