import Link from "next/link"
import { UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { requireAdmin } from "@/modules/admin/access"
import {
  AdminPageHeader,
  DataTable,
  SearchForm,
  TableCell,
  TableRow,
} from "@/modules/admin/components"

export default async function AdminFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const admin = await requireAdmin()
  const isSuperAdmin = admin.roleAssignments.some(
    (assignment) => assignment.role === UserRole.SUPER_ADMIN
  )

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Files"
          description="Uploaded LMS files are available to super admins only."
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This file library is restricted to Super Admin accounts.
        </div>
      </div>
    )
  }

  const { q = "" } = await searchParams
  const query = q.trim()
  const files = await getPrismaClient().fileAsset.findMany({
    where: query
      ? {
          OR: [
            { originalName: { contains: query, mode: "insensitive" } },
            { contentType: { contains: query, mode: "insensitive" } },
            {
              organization: {
                name: { contains: query, mode: "insensitive" },
              },
            },
            {
              campus: {
                name: { contains: query, mode: "insensitive" },
              },
            },
            {
              classSection: {
                name: { contains: query, mode: "insensitive" },
              },
            },
            {
              uploadedBy: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : undefined,
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
        description="Super admin library for uploaded LMS videos, PDFs, images, and lesson materials."
      />
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
                <Button asChild size="sm" variant="outline">
                  <Link href={href} target="_blank">
                    {canOpenInline ? "Open" : "Download"}
                  </Link>
                </Button>
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
