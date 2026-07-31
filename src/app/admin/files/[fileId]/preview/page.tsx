import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import {
  getScopedWhereForAdmin,
  isSuperAdmin,
  requireAdmin,
} from "@/modules/admin/access"
import { AdminPageHeader } from "@/modules/admin/components"

export default async function AdminFilePreviewPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const admin = await requireAdmin()
  const { fileId } = await params
  const file = await getPrismaClient().fileAsset.findFirst({
    where: {
      AND: [{ id: fileId }, getScopedWhereForAdmin(admin)],
    },
    select: {
      byteSize: true,
      campus: { select: { name: true } },
      classSection: { select: { name: true } },
      contentType: true,
      createdAt: true,
      id: true,
      originalName: true,
      organization: { select: { name: true } },
      uploadedBy: { select: { email: true, name: true } },
      visibility: true,
    },
  })

  if (!file) {
    notFound()
  }

  const isVideo = file.contentType?.startsWith("video/") ?? false
  const source = `/api/files/${file.id}/download`
  const inlineSource = `${source}?disposition=inline`

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="File preview"
        description="Preview uploaded LMS files through the permission-checked app route."
      />
      <div className="lms-soft-panel rounded-xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <h2 className="break-words text-xl font-semibold">
              {file.originalName}
            </h2>
            <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <Meta label="Type" value={file.contentType ?? "Unknown"} />
              <Meta label="Size" value={formatBytes(file.byteSize)} />
              <Meta label="Organization" value={file.organization.name} />
              <Meta label="Campus" value={file.campus?.name ?? "-"} />
              <Meta
                label="Class section"
                value={file.classSection?.name ?? "-"}
              />
              <Meta
                label="Uploader"
                value={file.uploadedBy?.name ?? file.uploadedBy?.email ?? "-"}
              />
              <Meta label="Uploaded" value={formatDate(file.createdAt)} />
              <Meta label="Visibility" value={file.visibility} />
              <Meta
                label="Access"
                value={isSuperAdmin(admin) ? "Super admin" : "Scoped admin"}
              />
            </dl>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/files">Back to files</Link>
            </Button>
            <Button asChild>
              <Link href={source} target="_blank">
                Download
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {isVideo ? (
        <div className="lms-soft-panel rounded-xl p-4">
          <video
            className="aspect-video w-full rounded-lg bg-black"
            controls
            preload="metadata"
            src={inlineSource}
          >
            Your browser does not support the video tag.
          </video>
          <p className="mt-3 text-xs text-muted-foreground">
            Video is streamed through LMS access checks. If playback is still
            slow, check server bandwidth, MinIO speed, and reverse proxy
            buffering.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This preview page is optimized for videos. Use Download or Open from
          the file list for PDFs and images.
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="break-words text-slate-900">{value}</dd>
    </div>
  )
}

function formatBytes(value: bigint | null) {
  if (!value) return "-"
  const bytes = Number(value)
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}
