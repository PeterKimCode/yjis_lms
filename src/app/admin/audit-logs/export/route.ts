import { getPrismaClient } from "@/lib/prisma"
import { getScopedWhereForAdmin, requireAdmin } from "@/modules/admin/access"

export async function GET(request: Request) {
  const admin = await requireAdmin()
  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const action = url.searchParams.get("action")?.trim() ?? ""
  const entityType = url.searchParams.get("entityType")?.trim() ?? ""
  const from = url.searchParams.get("from")?.trim() ?? ""
  const to = url.searchParams.get("to")?.trim() ?? ""
  const dateWhere = getDateWhere(from, to)
  const logs = await getPrismaClient().auditLog.findMany({
    where: {
      ...getScopedWhereForAdmin(admin),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(dateWhere ? { createdAt: dateWhere } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
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
  const csv = [
    [
      "createdAt",
      "action",
      "actorName",
      "actorEmail",
      "organization",
      "campusId",
      "entityType",
      "entityId",
      "summary",
    ],
    ...filteredLogs.map((log) => [
      log.createdAt.toISOString(),
      log.action,
      log.actor?.name ?? "System",
      log.actor?.email ?? "",
      log.organization.name,
      log.campusId ?? "",
      log.entityType,
      log.entityId ?? "",
      log.summary ?? "",
    ]),
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="audit-logs-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  })
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

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function matchesSearch(q: string, values: Array<string | null | undefined>) {
  const query = q.trim().toLowerCase()

  if (!query) return true

  return values.some((value) => value?.toLowerCase().includes(query))
}
