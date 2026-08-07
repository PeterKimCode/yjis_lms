import { InstitutionType } from "@prisma/client"
import Image from "next/image"

import { deleteAdminEntity, saveOrganization } from "@/modules/admin/actions"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  DeleteStatusBanner,
  FormCard,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAdminData } from "@/modules/admin/data"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string
    deleteError?: string
    organizationId?: string
    q?: string
    saveError?: string
  }>
}) {
  const { isSuperAdmin, organizations } = await getAdminData()
  const params = await searchParams
  const organizationId = params.organizationId?.trim() ?? ""
  const q = params.q?.trim() ?? ""
  const filteredOrganizations = organizations
    .filter((organization) => !organizationId || organization.id === organizationId)
    .filter((organization) =>
      matchesSearch(q, [
        organization.name,
        organization.slug,
        organization.institutionType,
      ])
    )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Organizations"
        description="Tenant organizations available in your admin scope."
      />
      <SearchForm
        hiddenFields={{ organizationId }}
        q={q}
        placeholder="Search organizations..."
        resetHref={
          organizationId
            ? `/admin/organizations?organizationId=${organizationId}`
            : "?"
        }
      />
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      {params.saveError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {params.saveError}
        </div>
      ) : null}
      {isSuperAdmin ? (
        <OrganizationForm />
      ) : (
        <div className="rounded-lg border bg-white/90 p-4 text-sm text-muted-foreground">
          Organization creation is limited to SUPER_ADMIN accounts. You can edit
          organizations already assigned to your admin scope.
        </div>
      )}
      <DataTable
        empty="No organizations are available for your scope."
        headers={["Name", "Slug", "Type", "Status", "Edit", "Delete"]}
        rows={filteredOrganizations.map((organization) => (
          <TableRow key={organization.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-3">
                <OrganizationLogoPreview
                  logoFileAssetId={organization.logoFileAsset?.id}
                  name={organization.name}
                />
                {organization.name}
              </div>
            </TableCell>
            <TableCell>{organization.slug}</TableCell>
            <TableCell>{organization.institutionType}</TableCell>
            <TableCell>
              <ActiveBadge active={organization.isActive} />
            </TableCell>
            <TableCell>
              <details className="rounded-lg border bg-white/90 p-3">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  Edit
                </summary>
                <div className="pt-3">
                  <OrganizationForm organization={organization} compact />
                </div>
              </details>
            </TableCell>
            <TableCell>
              <ConfirmDeleteForm
                action={deleteAdminEntity}
                entity="organization"
                id={organization.id}
                message={`Delete organization "${organization.name}"? This can remove related campus and LMS records.`}
                returnPath="/admin/organizations"
              />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function OrganizationForm({
  compact = false,
  organization,
}: {
  compact?: boolean
  organization?: {
    id: string
    name: string
    slug: string
    institutionType: InstitutionType
    websiteUrl: string | null
    isActive: boolean
    logoFileAsset?: { id: string } | null
  }
}) {
  const formClassName = compact
    ? "grid gap-4 lg:grid-cols-2"
    : "grid gap-4 lg:grid-cols-3"
  const form = (
      <form action={saveOrganization} className={formClassName}>
        <input name="id" type="hidden" value={organization?.id ?? ""} />
        {organization ? (
          <div className="flex min-w-0 items-center gap-3 lg:col-span-2">
            <OrganizationLogoPreview
              logoFileAssetId={organization.logoFileAsset?.id}
              name={organization.name}
              size="lg"
            />
            <p className="text-xs text-muted-foreground">
              Uploading a new logo replaces the sidebar logo for users in this
              organization. JPG, PNG, WEBP, or GIF only. Max 10MB.
            </p>
          </div>
        ) : null}
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
            name="name"
            defaultValue={organization?.name ?? ""}
            required
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Slug</span>
          <input
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
            name="slug"
            placeholder="example-school"
            defaultValue={organization?.slug ?? ""}
          />
          <span className="text-xs text-muted-foreground">
            URL-safe short name. If blank, it is generated from the name.
          </span>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Type</span>
          <select
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
            name="institutionType"
            defaultValue={organization?.institutionType ?? InstitutionType.ONLINE_SCHOOL}
          >
            {Object.values(InstitutionType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm lg:col-span-2">
          <span className="font-medium">Homepage URL</span>
          <input
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"
            name="websiteUrl"
            placeholder="https://www.school.edu"
            defaultValue={organization?.websiteUrl ?? ""}
          />
          <span className="text-xs text-muted-foreground">
            Used on generated transcript backgrounds when available.
          </span>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Organization logo</span>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="min-w-0 rounded-lg border border-input bg-background px-2 py-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium"
            name="logo"
            type="file"
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-end gap-4">
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={organization?.isActive ?? true}
          />
          Active
        </label>
          <SubmitButton />
        </div>
      </form>
  )

  if (compact) {
    return form
  }

  return (
    <FormCard title={organization ? "Edit organization" : "Create organization"}>
      {form}
    </FormCard>
  )
}

function OrganizationLogoPreview({
  logoFileAssetId,
  name,
  size = "sm",
}: {
  logoFileAssetId?: string | null
  name: string
  size?: "sm" | "lg"
}) {
  const dimensions = size === "lg" ? "h-16 w-16" : "h-9 w-9"
  const imageUrl = logoFileAssetId
    ? `/api/files/${logoFileAssetId}/download?disposition=inline`
    : "/brand/gtcc-logo.png"

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border bg-slate-50 ${dimensions}`}
    >
      <Image
        alt={`${name} logo`}
        className="h-full w-full object-contain"
        height={size === "lg" ? 64 : 36}
        src={imageUrl}
        width={size === "lg" ? 64 : 36}
        unoptimized={Boolean(logoFileAssetId)}
      />
    </span>
  )
}
