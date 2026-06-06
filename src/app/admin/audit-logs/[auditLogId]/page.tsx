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
        <DetailItem label="Time" value={formatDateTime(log.createdAt)} />
        <DetailItem label="Action" value={log.action} />
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

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  })
}
