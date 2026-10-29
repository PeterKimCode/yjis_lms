import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { UserRole } from "@prisma/client"
import { requireAnyRole } from "@/modules/auth/permissions"
import { getPrismaClient } from "@/lib/prisma"
import { canPublishNotice } from "@/modules/catalog/rules"
import { saveLoginNotice } from "@/modules/catalog/notices"
import { CatalogForm } from "@/modules/catalog/action-form"
import { OrganizationLoginVisibility } from "@/modules/catalog/organization-login-visibility"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
export default async function LoginNoticesPage({ searchParams }: { searchParams: Promise<{ organization?: string; notice?: string; create?: string }> }) {
  const params = await searchParams
  const user = await requireAnyRole([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN]), prisma = getPrismaClient()
  const superAdmin = user.roleAssignments.some(a => a.role === UserRole.SUPER_ADMIN)
  const organizations = await prisma.organization.findMany({ where: superAdmin ? {} : { id: { in: user.roleAssignments.filter(a => canPublishNotice([a], a.organizationId)).map(a => a.organizationId) } }, select: { id: true, name: true, timezone: true, showOnLogin: true }, orderBy: { name: "asc" } })
  const notices = await prisma.loginNotice.findMany({ where: { organizationId: { in: organizations.map(o => o.id) } }, orderBy: { createdAt: "desc" } })
  const selected = organizations.find(o => o.id === params.organization) ?? organizations[0]
  const selectedNotices = notices.filter(n => n.organizationId === selected?.id)
  const editing = selectedNotices.find(n => n.id === params.notice)
  const boardUrl = selected ? `/admin/login-notices?organization=${encodeURIComponent(selected.id)}` : "/admin/login-notices"
  return <div className="mx-auto w-full max-w-5xl space-y-6">
    <header><h1 className="text-2xl font-semibold">Login notices</h1></header>
    <nav aria-label="Organizations" className="flex overflow-x-auto border-b border-slate-300">
      {organizations.map(o => <Link key={o.id} href={`/admin/login-notices?organization=${encodeURIComponent(o.id)}`} aria-current={selected?.id === o.id ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${selected?.id === o.id ? "border-[#8D472F] bg-white text-[#8D472F]" : "border-transparent hover:bg-white/70"}`}>{o.name}</Link>)}
    </nav>
    {selected && superAdmin ? <OrganizationLoginVisibility key={selected.id} organizationId={selected.id} visible={selected.showOnLogin} /> : null}
    {selected ? <section className="overflow-hidden rounded-xl border bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="text-lg font-semibold">{params.create === "1" ? "Create login notice" : editing ? "Edit login notice" : selected.name}</h2>
        {params.create === "1" || editing ? <Button asChild variant="outline"><Link href={boardUrl}>Back to notices</Link></Button> : <Button asChild><Link href={`${boardUrl}&create=1`}>Create login notice</Link></Button>}
      </header>
      {params.create === "1" || editing ? <div className="p-5"><NoticeForm key={editing?.id ?? `new-${selected.id}`} organization={selected} notice={editing} /></div> : <div className="divide-y">
        {selectedNotices.map(n => <Link key={n.id} href={`${boardUrl}&notice=${encodeURIComponent(n.id)}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50">
          <span className="min-w-0 break-words font-medium">{n.title}</span><span className="text-xs text-slate-600">{formatDateTimeInTimeZone(n.createdAt, selected.timezone)} · {n.isPublished ? "Published / scheduled" : "Draft"} · Edit</span>
        </Link>)}
        {!selectedNotices.length ? <p className="p-5 text-sm text-slate-600">No notices yet.</p> : null}
      </div>}
    </section> : <p className="text-sm text-slate-600">No organizations available.</p>}
  </div>
}
function NoticeForm({ organization, notice }: { organization: { id: string; timezone: string }; notice?: { id: string; title: string; body: string; isPublished: boolean } }) {
  return <CatalogForm action={saveLoginNotice}><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="id" value={notice?.id ?? ""} /><label className="grid gap-2 text-sm">Title<Input name="title" maxLength={180} required defaultValue={notice?.title} /></label><label className="grid gap-2 text-sm">Notice<Textarea name="body" required maxLength={10000} rows={5} defaultValue={notice?.body} /></label><label className="flex items-center gap-2 text-sm"><Switch name="isPublished"  defaultChecked={notice?.isPublished} />Publish on login page</label><Button>Save notice</Button></CatalogForm>
}
