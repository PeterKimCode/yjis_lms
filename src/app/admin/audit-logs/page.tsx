import Link from "next/link"

import { getPrismaClient } from "@/lib/prisma"
import {
  AdminPageHeader,
  DataTable,
  TableCell,
  TableRow,
  matchesSearch,
} from "@/modules/admin/components"
import {
  getScopedWhereForAdmin,
  requireAdmin,
} from "@/modules/admin/access"

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string
    entityType?: string
    from?: string
    q?: string
    to?: string
  }>
}) {
  const admin = await requireAdmin()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const action = params.action?.trim() ?? ""
  const entityType = params.entityType?.trim() ?? ""
  const from = params.from?.trim() ?? ""
  const to = params.to?.trim() ?? ""
  const dateWhere = getDateWhere(from, to)
  const logs = await getPrismaClient().auditLog.findMany({
    where: {
      ...getScopedWhereForAdmin(admin),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateWhere ? { createdAt: dateWhere } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      actor: {
        select: {
          email: true,
          name: true,
        },
      },
      organization: {
        select: {
          name: true,
          timezone: true,
        },
      },
    },
  })
  const filteredLogs = logs.filter((log) =>
    matchesSearch(q, [
      log.action,
      log.entityType,
      log.entityId,
      log.summary,
      log.actor?.name,
      log.actor?.email,
      log.organization.name,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit Logs"
        description="Recent security-sensitive admin activity in your scope."
      />
      <AuditLogFilters
        action={action}
        entityType={entityType}
        from={from}
        q={q}
        to={to}
        resultSummary={`${filteredLogs.length} of ${logs.length} recent audit logs shown`}
      />
      <DataTable
        empty="No audit logs yet."
        headers={[
          "Time",
          "Action",
          "Actor",
          "Organization",
          "Entity",
          "Summary",
          "Open",
        ]}
        minWidth="min-w-[980px]"
        rows={filteredLogs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>{formatDateTime(log.createdAt, log.organization.timezone)}</TableCell>
            <TableCell>
              <AuditActionBadge action={log.action} />
            </TableCell>
            <TableCell>
              <div className="max-w-[220px] truncate">
                {log.actor?.name ?? "System"}
              </div>
              {log.actor?.email ? (
                <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                  {log.actor.email}
                </div>
              ) : null}
            </TableCell>
            <TableCell>{log.organization.name}</TableCell>
            <TableCell>
              <div>{log.entityType}</div>
              {log.entityId ? (
                <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                  {log.entityId}
                </div>
              ) : null}
            </TableCell>
            <TableCell>
              <span className="line-clamp-2">{log.summary ?? "-"}</span>
            </TableCell>
            <TableCell>
              <Link
                className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
                href={`/admin/audit-logs/${log.id}`}
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      />
      <p className="text-xs text-muted-foreground">
        Showing up to 250 audit logs for the selected filters. Use CSV export
        for lightweight review; use database backups for full historical
        retention.
      </p>
    </div>
  )
}

function AuditLogFilters({
  action,
  entityType,
  from,
  q,
  resultSummary,
  to,
}: {
  action: string
  entityType: string
  from: string
  q: string
  resultSummary: string
  to: string
}) {
  const exportHref = getExportHref({ action, entityType, from, q, to })

  return (
    <form className="lms-soft-panel rounded-lg p-3" action="">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm xl:col-span-2"
          defaultValue={q}
          name="q"
          placeholder="Search action, user, organization..."
        />
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={action}
          name="action"
          placeholder="Action, e.g. user.update"
        />
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={entityType}
          name="entityType"
          placeholder="Entity, e.g. User"
        />
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={from}
          name="from"
          title="From date"
          type="date"
        />
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={to}
          name="to"
          title="To date"
          type="date"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="h-8 rounded-lg border border-input px-3 text-sm font-medium hover:bg-accent"
          type="submit"
        >
          Filter
        </button>
        <a className="text-sm text-muted-foreground hover:text-foreground" href="?">
          Reset
        </a>
        <a
          className="h-8 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
          href={exportHref}
        >
          Export CSV
        </a>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{resultSummary}</p>
    </form>
  )
}

function getExportHref(params: {
  action: string
  entityType: string
  from: string
  q: string
  to: string
}) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }

  return `/admin/audit-logs/export${search.size ? `?${search.toString()}` : ""}`
}

function AuditActionBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getActionBadgeClass(action)}`}
    >
      {action}
    </span>
  )
}

function getActionBadgeClass(action: string) {
  if (action.includes("delete") || action.includes("remove")) {
    return "border-red-200 bg-red-50 text-red-700"
  }
  if (action.includes("login") || action.includes("auth")) {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }
  if (action.includes("file") || action.includes("download")) {
    return "border-sky-200 bg-sky-50 text-sky-700"
  }
  if (action.includes("policy") || action.includes("grading")) {
    return "border-violet-200 bg-violet-50 text-violet-700"
  }
  if (action.includes("create") || action.includes("save") || action.includes("update")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  return "border-slate-200 bg-slate-50 text-slate-700"
}

function getDateWhere(from: string, to: string) {
  const where: { gte?: Date; lte?: Date } = {}

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`)
    if (!Number.isNaN(fromDate.getTime())) where.gte = fromDate
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59.999`)
    if (!Number.isNaN(toDate.getTime())) where.lte = toDate
  }

  return Object.keys(where).length ? where : null
}

function formatDateTime(value: Date, timeZone: string | null | undefined) {
  return value.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: timeZone || undefined,
    timeZoneName: "short",
    year: "numeric",
  })
}
