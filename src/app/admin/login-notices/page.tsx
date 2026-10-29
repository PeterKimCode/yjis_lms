import { UserRole } from "@prisma/client"
import { requireAnyRole } from "@/modules/auth/permissions"
import { getPrismaClient } from "@/lib/prisma"
import { canPublishNotice } from "@/modules/catalog/rules"
import { saveLoginNotice } from "@/modules/catalog/notices"
import { CatalogForm } from "@/modules/catalog/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { dateTimeLocalInTimeZone } from "@/lib/timezone"
export default async function LoginNoticesPage() {
  const user = await requireAnyRole([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN]), prisma = getPrismaClient()
  const organizations = await prisma.organization.findMany({ where: user.roleAssignments.some(a => a.role === "SUPER_ADMIN") ? {} : { id: { in: user.roleAssignments.filter(a => canPublishNotice([a], a.organizationId)).map(a => a.organizationId) } }, select: { id: true, name: true, timezone: true }, orderBy: { name: "asc" } })
  const notices = await prisma.loginNotice.findMany({ where: { organizationId: { in: organizations.map(o => o.id) } }, orderBy: { createdAt: "desc" } })
  return <div className="mx-auto w-full max-w-5xl space-y-6"><header><h1 className="text-2xl font-semibold">Login notices</h1></header>{organizations.map(o => <section className="space-y-4" key={o.id}><h2 className="text-xl font-semibold">{o.name}</h2><details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Create login notice</summary><div className="pt-4"><NoticeForm organization={o} /></div></details>{notices.filter(n => n.organizationId === o.id).map(n => <details className="rounded-xl border bg-white p-4" key={n.id}><summary className="cursor-pointer font-medium">{n.title} · {n.isPublished ? "Published / scheduled" : "Draft"}</summary><div className="pt-4"><NoticeForm organization={o} notice={n} /></div></details>)}</section>)}</div>
}
function NoticeForm({ organization, notice }: { organization: { id: string; timezone: string }; notice?: { id: string; title: string; body: string; isPublished: boolean; startsAt: Date | null; endsAt: Date | null } }) {
  return <CatalogForm action={saveLoginNotice}><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="id" value={notice?.id ?? ""} /><label className="grid gap-2 text-sm">Title<Input name="title" maxLength={180} required defaultValue={notice?.title} /></label><label className="grid gap-2 text-sm">Notice<Textarea name="body" required maxLength={10000} rows={5} defaultValue={notice?.body} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm">Starts at<Input name="startsAt" type="datetime-local" defaultValue={notice?.startsAt ? dateTimeLocalInTimeZone(notice.startsAt, organization.timezone) : ""} /></label><label className="grid gap-2 text-sm">Ends at<Input name="endsAt" type="datetime-local" defaultValue={notice?.endsAt ? dateTimeLocalInTimeZone(notice.endsAt, organization.timezone) : ""} /></label></div><label className="flex items-center gap-2 text-sm"><input name="isPublished" type="checkbox" defaultChecked={notice?.isPublished} />Publish on login page</label><Button>Save notice</Button></CatalogForm>
}
