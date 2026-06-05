import { getPrismaClient } from "@/lib/prisma"
import {
  AdminPageHeader,
  DataTable,
  SearchForm,
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
  searchParams: Promise<{ q?: string }>
}) {
  const admin = await requireAdmin()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const logs = await getPrismaClient().auditLog.findMany({
    where: getScopedWhereForAdmin(admin),
    orderBy: { createdAt: "desc" },
    take: 100,
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
      <SearchForm
        q={q}
        placeholder="Search action, user, organization..."
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
        ]}
        minWidth="min-w-[980px]"
        rows={filteredLogs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>{formatDateTime(log.createdAt)}</TableCell>
            <TableCell className="font-medium">{log.action}</TableCell>
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
          </TableRow>
        ))}
      />
      <p className="text-xs text-muted-foreground">
        Showing the latest 100 audit logs. Use database export for full
        historical review.
      </p>
    </div>
  )
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
