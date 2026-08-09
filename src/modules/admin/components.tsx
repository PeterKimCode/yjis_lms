import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/modules/dashboards/components"

export const adminPrimaryLinks = [
  ["/admin", "Overview"],
  ["/admin/courses", "Courses"],
  ["/admin/class-sections", "Class Sections"],
  ["/admin/users", "Users"],
  ["/admin/boards", "Boards"],
  ["/admin/files", "Files"],
  ["/admin/audit-logs", "Audit Logs"],
] as const

export const adminSetupLinks = [
  ["/admin/organizations", "Organizations"],
  ["/admin/campuses", "Campuses"],
  ["/admin/departments", "Departments"],
  ["/admin/academic-years", "Academic Years"],
  ["/admin/terms", "Terms"],
  ["/admin/grade-levels", "Grade Levels"],
  ["/admin/homerooms", "Homerooms"],
  ["/admin/policies", "Policies"],
] as const

export const adminCommunicationLinks = [
  ["/messages", "Messages"],
  ["/notifications", "Notifications"],
] as const

export const adminLinks = [
  ...adminPrimaryLinks,
  ...adminSetupLinks,
  ...adminCommunicationLinks,
] as const

export function AdminPageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="lms-soft-panel animate-in fade-in-50 slide-in-from-bottom-2 space-y-1 rounded-xl p-5 duration-500">
      <div className="h-1.5 w-16 rounded-full bg-primary/70" />
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/85 p-8 text-center text-sm text-muted-foreground shadow-sm shadow-slate-200/60">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-primary/20" />
      <p className="font-medium text-slate-700">Nothing to show yet</p>
      <p className="mt-1">{label}</p>
    </div>
  )
}

const deleteEntityLabels: Record<string, string> = {
  academicYear: "Academic year",
  board: "Board",
  campus: "Campus",
  classSection: "Class section",
  course: "Course",
  department: "Department",
  gradeLevel: "Grade level",
  homeroom: "Homeroom",
  organization: "Organization",
  term: "Term",
  user: "User",
}

export function DeleteStatusBanner({
  deleted,
  deleteError,
}: {
  deleted?: string
  deleteError?: string
}) {
  if (deleted) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        {deleteEntityLabels[deleted] ?? "Record"} deleted.
      </div>
    )
  }

  if (deleteError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Could not delete {deleteEntityLabels[deleteError] ?? "this record"}. It
        may still be used by related LMS records.
      </div>
    )
  }

  return null
}

export function FormCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card className="lms-card animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function DataTable({
  headers,
  rows,
  empty,
  minWidth = "min-w-[760px]",
}: {
  headers: ReactNode[]
  rows: ReactNode[]
  empty: string
  minWidth?: string
}) {
  if (rows.length === 0) {
    return <EmptyState label={empty} />
  }

  return (
    <div className="max-h-[72vh] overflow-auto rounded-lg border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
      <Table
        className={`${minWidth} [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-slate-50/80`}
      >
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead
                className="sticky top-0 z-10 whitespace-nowrap border-b bg-slate-50/95 backdrop-blur"
                key={index}
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows}</TableBody>
      </Table>
    </div>
  )
}

export function SearchForm({
  hiddenFields,
  q,
  placeholder = "Search...",
  resultSummary,
  resetHref = "?",
}: {
  hiddenFields?: Record<string, string | undefined>
  q: string
  placeholder?: string
  resultSummary?: string
  resetHref?: string
}) {
  return (
    <form
      className="lms-soft-panel sticky top-16 z-20 rounded-lg p-3 supports-[backdrop-filter]:bg-white/85"
      action=""
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) =>
            value ? (
              <input key={name} name={name} type="hidden" value={value} />
            ) : null
          )
        : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          className="sm:max-w-sm"
          name="q"
          placeholder={placeholder}
          defaultValue={q}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Search
          </Button>
          {q ? (
            <Button asChild type="button" variant="ghost">
              <Link href={resetHref}>Clear</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {resultSummary ? (
        <p className="mt-2 text-xs text-muted-foreground">{resultSummary}</p>
      ) : null}
    </form>
  )
}

export function matchesSearch(q: string, values: Array<string | null | undefined>) {
  const query = q.trim().toLowerCase()

  if (!query) return true

  return values.some((value) => value?.toLowerCase().includes(query))
}

export function AdminSelect({
  name,
  label,
  defaultValue,
  options,
  required,
  includeEmpty = true,
}: {
  name: string
  label: string
  defaultValue?: string | null
  options: { id: string; label: string }[]
  required?: boolean
  includeEmpty?: boolean
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
      >
        {includeEmpty ? <option value="">None</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required,
}: {
  name: string
  label: string
  defaultValue?: string | number | null
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
    </label>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <StatusBadge
      label={active ? "Active" : "Inactive"}
      value={active ? "ACTIVE" : "INACTIVE"}
    />
  )
}

export function SubmitButton({ label = "Save" }: { label?: string }) {
  return (
    <Button size="sm" type="submit">
      {label}
    </Button>
  )
}

export function AdminLinkGrid({ organizationId = "" }: { organizationId?: string }) {
  const linksWithOrganization = (links: readonly (readonly [string, string])[]) =>
    links.map(([href, label]) => [
      withOrganizationQuery(href, organizationId),
      label,
    ] as const)

  return (
    <div className="space-y-4">
      <AdminLinkSection
        links={linksWithOrganization(
          adminPrimaryLinks.filter(([href]) => href !== "/admin")
        )}
        title="Core admin"
      />
      <AdminLinkSection
        links={linksWithOrganization(adminSetupLinks)}
        title="Academic setup"
      />
      <AdminLinkSection
        links={adminCommunicationLinks}
        title="Communication"
      />
    </div>
  )
}

function withOrganizationQuery(href: string, organizationId: string) {
  if (!organizationId) return href
  if (!href.startsWith("/admin")) return href
  if (href === "/admin") return `/admin?organizationId=${organizationId}`
  const separator = href.includes("?") ? "&" : "?"
  return `${href}${separator}organizationId=${organizationId}`
}

function AdminLinkSection({
  links,
  title,
}: {
  links: readonly (readonly [string, string])[]
  title: string
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(([href, label]) => (
          <Button key={href} asChild variant="outline">
            <Link href={href}>{label}</Link>
          </Button>
        ))}
      </div>
    </section>
  )
}

export { TableCell, TableRow }
