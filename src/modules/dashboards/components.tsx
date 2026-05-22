import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function DashboardPage({
  title,
  description,
  actions,
  children,
  tone = "default",
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
  tone?: "default" | "admin" | "instructor" | "student" | "parent"
}) {
  return (
    <main className={`flex-1 px-4 py-8 ${getPageToneClass(tone)}`}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="lms-soft-panel flex flex-col gap-3 rounded-xl p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="h-1.5 w-16 rounded-full bg-primary/70" />
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </main>
  )
}

export function MetricCard({
  label,
  value,
  href,
  description,
  tone = "default",
}: {
  label: string
  value: string | number
  href?: string
  description?: string
  tone?: "default" | "attention"
}) {
  const card = (
    <Card
      className={`lms-card ${href ? "lms-card-hover" : ""} ${
        tone === "attention" ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold">{value}</div>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  )

  return href ? <Link href={href}>{card}</Link> : card
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-muted-foreground">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />
      <div>{children}</div>
    </div>
  )
}

export function ActionPanel({
  title = "Today at a glance",
  description,
  children,
}: {
  title?: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="lms-soft-panel rounded-xl p-4">
      <div className="mb-3 space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">{children}</div>
    </section>
  )
}

export function ActionCard({
  title,
  description,
  href,
  actionLabel = "Open",
  badge,
}: {
  title: string
  description: string
  href: string
  actionLabel?: string
  badge?: string | number
}) {
  return (
    <Link
      className="lms-card lms-card-hover rounded-lg p-3"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {badge ? <Badge variant="secondary">{badge}</Badge> : null}
      </div>
      <p className="mt-3 text-xs font-medium text-primary">{actionLabel}</p>
    </Link>
  )
}

export function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: ReactNode[]
  empty: ReactNode
}) {
  if (rows.length === 0) {
    return <EmptyState>{empty}</EmptyState>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows}</TableBody>
      </Table>
    </div>
  )
}

export function SectionBlock({
  title,
  description,
  id,
  meta,
  children,
}: {
  title: string
  description?: string
  id?: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      className={`lms-card scroll-mt-24 overflow-hidden ${getSectionAccentClass(title)}`}
      id={id}
    >
      <CardHeader className="gap-2 border-b border-slate-100/90 bg-white/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--section-accent,#2563eb)]" />
              {title}
            </CardTitle>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function ModeBadge({ value }: { value: string }) {
  return <Badge variant="secondary">{value}</Badge>
}

export function StatusBadge({
  value,
  label,
}: {
  value: string | boolean | null | undefined
  label?: string
}) {
  const text = label ?? getStatusLabel(value)
  const tone = getStatusTone(value)

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {text}
    </span>
  )
}

export function OpenButton({ href }: { href: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>Open</Link>
    </Button>
  )
}

export { TableCell, TableRow }

function getStatusLabel(value: string | boolean | null | undefined) {
  if (value === true) return "Yes"
  if (value === false) return "No"
  if (value === null || value === undefined || value === "") return "-"

  const labels: Record<string, string> = {
    ABSENT: "Absent",
    ACTIVE: "Active",
    COMPLETED: "Completed",
    DRAFT: "Draft",
    ENROLLED: "Enrolled",
    EXCUSED: "Excused",
    FINALIZED: "Finalized",
    GRADED: "Graded",
    IN_PROGRESS: "In progress",
    LATE: "Late",
    MISSING: "Missing",
    NOT_SUBMITTED: "Not submitted",
    PENDING: "Pending",
    PRESENT: "Present",
    PUBLISHED: "Published",
    SICK_LEAVE: "Sick leave",
    SUBMITTED: "Submitted",
  }

  return labels[value] ?? value.replaceAll("_", " ").toLowerCase()
}

function getStatusTone(value: string | boolean | null | undefined) {
  if (value === true) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (value === false) return "border-slate-200 bg-slate-50 text-slate-600"

  switch (value) {
    case "ACTIVE":
    case "COMPLETED":
    case "ENROLLED":
    case "FINALIZED":
    case "GRADED":
    case "PRESENT":
    case "PUBLISHED":
    case "SUBMITTED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "DRAFT":
    case "IN_PROGRESS":
    case "LATE":
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "ABSENT":
    case "MISSING":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "EXCUSED":
    case "SICK_LEAVE":
      return "border-sky-200 bg-sky-50 text-sky-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-600"
  }
}

function getPageToneClass(tone: "default" | "admin" | "instructor" | "student" | "parent") {
  switch (tone) {
    case "admin":
      return "role-admin-surface"
    case "instructor":
      return "role-instructor-surface"
    case "student":
      return "role-student-surface"
    case "parent":
      return "role-parent-surface"
    default:
      return "app-shell-surface"
  }
}

function getSectionAccentClass(title: string) {
  const normalized = title.toLowerCase()
  if (normalized.includes("lesson")) {
    return "[--section-accent:#2563eb] border-l-4 border-l-blue-400"
  }
  if (normalized.includes("attendance")) {
    return "[--section-accent:#059669] border-l-4 border-l-emerald-400"
  }
  if (normalized.includes("assignment")) {
    return "[--section-accent:#7c3aed] border-l-4 border-l-violet-400"
  }
  if (normalized.includes("quiz")) {
    return "[--section-accent:#0284c7] border-l-4 border-l-sky-400"
  }
  if (normalized.includes("exam")) {
    return "[--section-accent:#d97706] border-l-4 border-l-amber-400"
  }
  if (normalized.includes("grade")) {
    return "[--section-accent:#ca8a04] border-l-4 border-l-yellow-400"
  }
  if (normalized.includes("board")) {
    return "[--section-accent:#db2777] border-l-4 border-l-pink-400"
  }
  return "[--section-accent:#2563eb] border-l-4 border-l-blue-300"
}
