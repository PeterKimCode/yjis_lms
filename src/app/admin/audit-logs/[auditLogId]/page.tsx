import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { AdminPageHeader } from "@/modules/admin/components"
import {
  getScopedWhereForAdmin,
  requireAdmin,
} from "@/modules/admin/access"

export default async function AdminAuditLogDetailPage({
  params,
}: {
  params: Promise<{ auditLogId: string }>
}) {
  const admin = await requireAdmin()
  const { auditLogId } = await params
  const log = await getPrismaClient().auditLog.findFirst({
    where: {
      id: auditLogId,
      ...getScopedWhereForAdmin(admin),
    },
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

  if (!log) notFound()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline">
          <Link href="/admin/audit-logs">Back to audit logs</Link>
        </Button>
      </div>
      <AdminPageHeader
        title="Audit Log Detail"
        description="A single security-sensitive event recorded by the LMS."
      />
      <section className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm md:grid-cols-2">
        <DetailItem
          label="Time"
          value={formatDateTime(log.createdAt, log.organization.timezone)}
        />
        <div className="min-w-0 rounded-lg border bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Action
          </p>
          <div className="mt-1">
            <AuditActionBadge action={log.action} />
          </div>
        </div>
        <DetailItem label="Actor" value={log.actor?.name ?? "System"} />
        <DetailItem label="Actor email" value={log.actor?.email ?? "-"} />
        <DetailItem label="Organization" value={log.organization.name} />
        <DetailItem label="Campus ID" value={log.campusId ?? "-"} />
        <DetailItem label="Entity type" value={log.entityType} />
        <DetailItem label="Entity ID" value={log.entityId ?? "-"} />
        <div className="md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
            {log.summary ?? "-"}
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metadata
          </p>
          <pre className="mt-1 max-h-[420px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
            {JSON.stringify(log.metadata ?? {}, null, 2)}
          </pre>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        Audit logs are for accountability and troubleshooting. They do not
        replace database backups.
      </p>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  )
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

function formatDateTime(value: Date, timeZone: string | null | undefined) {
  return value.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZone: timeZone || undefined,
    timeZoneName: "short",
    year: "numeric",
  })
}
