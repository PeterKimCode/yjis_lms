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
  ["/admin/class-sections", "Class Sections"],
  ["/admin/courses", "Courses"],
  ["/admin/users", "Users"],
  ["/admin/boards", "Boards"],
] as const

export const adminSetupLinks = [
  ["/admin/organizations", "Organizations"],
  ["/admin/campuses", "Campuses"],
  ["/admin/academic-years", "Academic Years"],
  ["/admin/terms", "Terms"],
  ["/admin/grade-levels", "Grade Levels"],
  ["/admin/homerooms", "Homerooms"],
  ["/admin/departments", "Departments"],
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
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function FormCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card>
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
  headers: string[]
  rows: ReactNode[]
  empty: string
  minWidth?: string
}) {
  if (rows.length === 0) {
    return <EmptyState label={empty} />
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className={minWidth}>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead className="whitespace-nowrap" key={header}>
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
  q,
  placeholder = "Search...",
  resultSummary,
}: {
  q: string
  placeholder?: string
  resultSummary?: string
}) {
  return (
    <form className="rounded-lg border bg-background p-3" action="">
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
              <Link href="?">Clear</Link>
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
  type = "text",
  required,
}: {
  name: string
  label: string
  defaultValue?: string | number | null
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

export function AdminLinkGrid() {
  return (
    <div className="space-y-4">
      <AdminLinkSection
        links={adminPrimaryLinks.filter(([href]) => href !== "/admin")}
        title="Core admin"
      />
      <AdminLinkSection links={adminSetupLinks} title="Academic setup" />
      <AdminLinkSection
        links={adminCommunicationLinks}
        title="Communication"
      />
    </div>
  )
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
