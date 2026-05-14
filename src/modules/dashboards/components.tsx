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
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="flex-1 bg-muted/40 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
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
}: {
  label: string
  value: string | number
  href?: string
}) {
  const card = (
    <Card className={href ? "transition-colors hover:bg-muted/60" : ""}>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )

  return href ? <Link href={href}>{card}</Link> : card
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
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
    <div className="overflow-x-auto rounded-lg border bg-background">
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

export function ModeBadge({ value }: { value: string }) {
  return <Badge variant="secondary">{value}</Badge>
}

export function OpenButton({ href }: { href: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>Open</Link>
    </Button>
  )
}

export { TableCell, TableRow }
