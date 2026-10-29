import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getPrismaClient } from "@/lib/prisma"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { LoginForm } from "@/modules/auth/login-form"
import { getPostLoginPath } from "@/modules/auth/roles"
import { getCurrentSession } from "@/modules/auth/session"

export const metadata = { title: "Log in", description: "School news and learning, together in one place." }
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ organization?: string; error?: string; expired?: string; notice?: string }> }) {
  const session = await getCurrentSession(), params = await searchParams
  if (session?.user?.id) redirect(getPostLoginPath(session.user.roleAssignments))
  const prisma = getPrismaClient(), now = new Date()
  const organizations = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true, logoFileAssetId: true }, orderBy: { name: "asc" } })
  const selected = organizations.find(o => o.slug === params.organization)
  const notices = await prisma.loginNotice.findMany({ where: { isPublished: true, organization: { isActive: true }, ...(selected ? { organizationId: selected.id } : {}), AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] }, select: { id: true, title: true, body: true, createdAt: true, organization: { select: { name: true, timezone: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })
  function filterUrl(slug?: string) { const q = new URLSearchParams(); if (slug) q.set("organization", slug); if (params.error) q.set("error", params.error); if (params.expired) q.set("expired", params.expired); return `/login${q.size ? `?${q}` : ""}` }
  const openNotice = notices.find(n => n.id === params.notice)
  const tabClass = (active: boolean) => `inline-flex min-w-0 max-w-full items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${active ? "border-[#8D472F] bg-white text-[#8D472F]" : "border-transparent text-slate-600 hover:bg-white/70"}`
  return <main className="relative flex-1 overflow-x-hidden bg-gradient-to-br from-blue-50 via-white to-sky-100 px-4 py-8 sm:px-6 lg:py-14">
    <div className="relative mx-auto grid w-full max-w-7xl items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)] lg:gap-12">
      <section className="order-2 min-w-0 space-y-7 lg:order-1">
        <h1 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Learning Management System</h1>
        <section aria-labelledby="school-selector" className="min-w-0 space-y-4">
          <h2 id="school-selector" className="text-lg font-semibold">Our schools</h2>
          <nav aria-label="School notices by organization" className="flex flex-wrap gap-x-1 gap-y-1 border-b border-slate-300">
            <Link href={filterUrl()} aria-current={!selected ? "page" : undefined} className={tabClass(!selected)}>All schools</Link>
            {organizations.map(o => <Link key={o.id} href={filterUrl(o.slug)} aria-current={selected?.id === o.id ? "page" : undefined} className={tabClass(selected?.id === o.id)}>
              <Image src={o.logoFileAssetId ? `/api/public/organizations/${o.id}/logo` : "/icon.svg"} alt="" width={28} height={28} unoptimized className="size-7 shrink-0 object-contain" /><span className="min-w-0 break-words text-left [overflow-wrap:anywhere]">{o.name}</span>
            </Link>)}
          </nav>
          <section aria-labelledby="login-notices" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 id="login-notices" className="border-b border-slate-200 px-5 py-4 text-lg font-semibold">{selected ? `${selected.name} · Notices` : "School notices"}</h2>
            {openNotice ? <article className="space-y-4 p-5">
              <Link href={filterUrl(selected?.slug)} className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Back to notices</Link>
              <h3 className="text-xl font-semibold">{openNotice.title}</h3>
              <p className="text-xs text-slate-600">{openNotice.organization.name} · {formatDateTimeInTimeZone(openNotice.createdAt, openNotice.organization.timezone)}</p>
              <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{openNotice.body}</p>
            </article> : <div className="divide-y divide-slate-200">
              {notices.map(n => <Link key={n.id} href={`${filterUrl(selected?.slug)}${filterUrl(selected?.slug).includes("?") ? "&" : "?"}notice=${encodeURIComponent(n.id)}`} className="block space-y-1 px-5 py-4 hover:bg-slate-50">
                <h3 className="break-words text-base font-medium">{n.title}</h3>
                <p className="text-xs text-slate-600">{n.organization.name} · {formatDateTimeInTimeZone(n.createdAt, n.organization.timezone)}</p>
              </Link>)}
              {!notices.length ? <p className="p-5 text-sm text-slate-600">No public notices at the moment.</p> : null}
            </div>}
          </section>
        </section>
      </section>
      <section aria-labelledby="login-title" className="order-1 min-w-0 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-blue-900/5 sm:p-8 lg:order-2 lg:sticky lg:top-8">
        <div className="space-y-3"><Image src="/icon.svg" alt="" width={48} height={48} /><h2 id="login-title" className="text-2xl font-semibold">Log in to your LMS</h2></div>
        <LoginForm callbackUrl="/login/redirect" hasError={params.error === "CredentialsSignin"} initialMessage={params.expired === "1" ? "Session expired. Please log in again." : undefined} />
      </section>
    </div>
  </main>
}
