import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getPrismaClient } from "@/lib/prisma"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { LoginForm } from "@/modules/auth/login-form"
import { getPostLoginPath } from "@/modules/auth/roles"
import { getCurrentSession } from "@/modules/auth/session"

export const metadata = { title: "Log in", description: "School news and learning, together in one place." }
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ organization?: string; error?: string; expired?: string }> }) {
  const session = await getCurrentSession(), params = await searchParams
  if (session?.user?.id) redirect(getPostLoginPath(session.user.roleAssignments))
  const prisma = getPrismaClient(), now = new Date()
  const organizations = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true, slug: true, name: true, logoFileAssetId: true }, orderBy: { name: "asc" } })
  const selected = organizations.find(o => o.slug === params.organization)
  const notices = await prisma.loginNotice.findMany({ where: { isPublished: true, organization: { isActive: true }, ...(selected ? { organizationId: selected.id } : {}), AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] }, select: { id: true, title: true, body: true, createdAt: true, organization: { select: { name: true, timezone: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] })
  function filterUrl(slug?: string) { const q = new URLSearchParams(); if (slug) q.set("organization", slug); if (params.error) q.set("error", params.error); if (params.expired) q.set("expired", params.expired); return `/login${q.size ? `?${q}` : ""}` }
  return <main className="relative flex-1 overflow-x-hidden bg-gradient-to-br from-blue-50 via-white to-sky-100 px-4 py-8 sm:px-6 lg:py-14">
    <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-32 size-96 rounded-full bg-blue-200/30 blur-3xl" />
    <div className="relative mx-auto grid w-full max-w-7xl items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)] lg:gap-12">
      <section className="order-2 min-w-0 space-y-7 lg:order-1"><header className="space-y-3"><h1 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Learning Management System</h1></header>
      <section aria-labelledby="school-selector"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="school-selector" className="text-lg font-semibold">Our schools</h2><Link href={filterUrl()} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-800">All schools</Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{organizations.map(o => <Link key={o.id} href={filterUrl(o.slug)} aria-current={selected?.id === o.id ? "true" : undefined} className={`flex min-w-0 flex-col items-center gap-3 rounded-2xl border bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 ${selected?.id === o.id ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"}`}>{o.logoFileAssetId ? <Image src={`/api/public/organizations/${o.id}/logo`} alt="" width={64} height={64} unoptimized className="size-16 object-contain" /> : <span aria-hidden="true" className="grid size-16 place-items-center rounded-xl bg-blue-50 text-2xl font-semibold text-blue-700">{o.name.slice(0, 1)}</span>}<span className="break-words text-sm font-medium text-slate-800">{o.name}</span></Link>)}</div></section>
      <section aria-labelledby="login-notices" className="rounded-2xl border border-white bg-white/90 p-5 shadow-sm sm:p-6"><h2 id="login-notices" className="text-xl font-semibold">{selected ? `${selected.name} · Notices` : "School notices"}</h2><div className="mt-4 divide-y divide-slate-200">{notices.map(n => <details key={n.id} className="py-4"><summary className="cursor-pointer text-base font-medium text-slate-900">{n.title}<span className="mt-1 block text-xs font-normal text-slate-600">{n.organization.name} · {formatDateTimeInTimeZone(n.createdAt, n.organization.timezone)}</span></summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{n.body}</p></details>)}{!notices.length ? <p className="py-6 text-sm text-slate-600">No public notices at the moment.</p> : null}</div></section></section>
      <section aria-labelledby="login-title" className="order-1 min-w-0 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-blue-900/5 sm:p-8 lg:order-2 lg:sticky lg:top-24"><div className="space-y-3"><Image src="/icon.svg" alt="" width={48} height={48} /><h2 id="login-title" className="text-2xl font-semibold">Log in to your LMS</h2></div><LoginForm callbackUrl="/login/redirect" hasError={params.error === "CredentialsSignin"} initialMessage={params.expired === "1" ? "Session expired. Please log in again." : undefined} /></section>
    </div>
  </main>
}
