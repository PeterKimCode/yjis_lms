import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
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

export const adminLinks = [
  ["/admin", "Overview"],
  ["/admin/organizations", "Organizations"],
  ["/admin/campuses", "Campuses"],
  ["/admin/academic-years", "Academic Years"],
  ["/admin/terms", "Terms"],
  ["/admin/grade-levels", "Grade Levels"],
  ["/admin/homerooms", "Homerooms"],
  ["/admin/departments", "Departments"],
  ["/admin/courses", "Courses"],
  ["/admin/class-sections", "Class Sections"],
  ["/admin/users", "Users"],
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
}: {
  q: string
  placeholder?: string
}) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row" action="">
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
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
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
    <label className="grid gap-1 text-sm">
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
    <Badge variant={active ? "default" : "secondary"}>
      {active ? "Active" : "Inactive"}
    </Badge>
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {adminLinks.slice(1).map(([href, label]) => (
        <Button key={href} asChild variant="outline">
          <Link href={href}>{label}</Link>
        </Button>
      ))}
    </div>
  )
}

export { TableCell, TableRow }
