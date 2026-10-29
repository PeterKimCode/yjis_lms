import { requireAuth } from "@/modules/auth/permissions"
import { getPrismaClient } from "@/lib/prisma"
import { canReview } from "./rules"
import { CatalogForm } from "./action-form"
import { saveRecruitment } from "./actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
export async function RecruitmentSettings({ classSectionId }: { classSectionId: string }) {
  const user = await requireAuth(), section = await getPrismaClient().classSection.findUniqueOrThrow({ where: { id: classSectionId } })
  if (!canReview(user.roleAssignments, section)) return null
  return <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Student recruitment</h2><CatalogForm action={saveRecruitment}><input type="hidden" name="classSectionId" value={section.id} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRecruiting" defaultChecked={section.isRecruiting} />Accept applications in Browse classes</label><label className="grid gap-2 text-sm">Public class introduction<Textarea name="catalogDescription" rows={4} maxLength={5000} defaultValue={section.catalogDescription ?? ""} /></label><Button>Save recruitment settings</Button></CatalogForm></section>
}
