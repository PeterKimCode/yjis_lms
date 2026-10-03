import { notFound } from "next/navigation"
import { UserRole } from "@prisma/client"
import { requireAnyRole, canManageClassSection } from "@/modules/auth/permissions"
import { getPrismaClient } from "@/lib/prisma"
import { DashboardPage } from "@/modules/dashboards/components"
import { QuizEditor } from "@/modules/quizzes/quiz-editor"
export const metadata = { title: "Create assessment" }
export default async function CreateQuizPage({ params }: { params: Promise<{ classSectionId: string }> }) {
  const { classSectionId } = await params
  const user = await requireAnyRole([UserRole.SUPER_ADMIN,UserRole.ORG_ADMIN,UserRole.SCHOOL_ADMIN,UserRole.ACADEMIC_STAFF,UserRole.INSTRUCTOR,UserRole.HOMEROOM_TEACHER])
  if (!(await canManageClassSection(user.id,classSectionId))) notFound()
  const section = await getPrismaClient().classSection.findUnique({where:{id:classSectionId},include:{organization:{select:{timezone:true}}}})
  if (!section) notFound()
  return <DashboardPage title="Create assessment" description={section.name}><QuizEditor classSectionId={classSectionId} timeZone={section.organization.timezone} /></DashboardPage>
}
