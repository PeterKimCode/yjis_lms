import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import {
  getScopedWhereForAdmin,
  isSuperAdmin,
  requireAdmin,
} from "@/modules/admin/access"
import {
  AdminPageHeader,
  DataTable,
  SearchForm,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { DeleteFileButton } from "@/app/admin/files/delete-file-button"

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleteError?: string
    deleteSuccess?: string
    q?: string
  }>
}) {
  const admin = await requireAdmin()
  const canSeeAllFiles = isSuperAdmin(admin)

  const { deleteError, deleteSuccess, q = "" } = await searchParams
  const query = q.trim()
  const scopedWhere = getScopedWhereForAdmin(admin)
  const searchWhere = query
    ? {
        OR: [
          { originalName: { contains: query, mode: "insensitive" as const } },
          { contentType: { contains: query, mode: "insensitive" as const } },
          {
            organization: {
              name: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            campus: {
              name: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            classSection: {
              name: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            uploadedBy: {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { email: { contains: query, mode: "insensitive" as const } },
              ],
            },
          },
        ],
      }
    : {}
  const files = await getPrismaClient().fileAsset.findMany({
    where: {
      AND: [scopedWhere, searchWhere],
    },
    orderBy: { createdAt: "desc" },
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
    take: 200,
  })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Files"
        description="Uploaded LMS files in your admin scope, including videos, PDFs, images, and lesson materials."
      />
      {!canSeeAllFiles ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          School Admin view is limited to files in your assigned organization
          and campus scope.
        </div>
      ) : null}
      {deleteSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {deleteSuccess}
        </div>
      ) : null}
      {deleteError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {deleteError}
        </div>
      ) : null}
      <SearchForm
        q={q}
        placeholder="Search filename, type, organization, campus, class, uploader..."
        resultSummary={`${files.length} file${files.length === 1 ? "" : "s"} shown`}
      />
      <DataTable
        minWidth="min-w-[1100px]"
        empty="No uploaded files found."
        headers={[
          "File",
          "Type",
          "Size",
          "Organization",
          "Campus",
          "Class section",
          "Uploader",
          "Uploaded",
          "Visibility",
          "Actions",
        ]}
        rows={files.map((file) => {
          const canOpenInline = canOpenInBrowser(file.contentType)
          const href = `/api/files/${file.id}/download${
            canOpenInline ? "?disposition=inline" : ""
          }`

          return (
            <TableRow key={file.id}>
              <TableCell className="max-w-[260px] whitespace-normal font-medium">
                {file.originalName}
              </TableCell>
              <TableCell>{formatContentType(file.contentType)}</TableCell>
              <TableCell>{formatBytes(file.byteSize)}</TableCell>
              <TableCell>{file.organization.name}</TableCell>
              <TableCell>{file.campus?.name ?? "-"}</TableCell>
              <TableCell>{file.classSection?.name ?? "-"}</TableCell>
              <TableCell>
                {file.uploadedBy?.name ?? file.uploadedBy?.email ?? "-"}
              </TableCell>
              <TableCell>{formatDate(file.createdAt)}</TableCell>
              <TableCell>{file.visibility}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={href} target="_blank">
                      {canOpenInline ? "Open" : "Download"}
                    </Link>
                  </Button>
                  {canSeeAllFiles ? (
                    <DeleteFileButton
                      fileId={file.id}
                      fileName={file.originalName}
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      />
    </div>
  )
}

function canOpenInBrowser(contentType: string | null) {
  return (
    contentType?.startsWith("video/") ||
    contentType?.startsWith("image/") ||
    contentType === "application/pdf"
  )
}

function formatContentType(contentType: string | null) {
  if (!contentType) return "Unknown"
  if (contentType.startsWith("video/")) return "Video"
  if (contentType.startsWith("image/")) return "Image"
  if (contentType === "application/pdf") return "PDF"
  if (contentType.includes("presentation")) return "Presentation"
  if (contentType.includes("wordprocessing") || contentType.includes("msword")) {
    return "Document"
  }
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) {
    return "Spreadsheet"
  }
  return contentType
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
