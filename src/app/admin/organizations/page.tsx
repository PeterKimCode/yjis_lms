import { InstitutionType } from "@prisma/client"
import Image from "next/image"

import { saveOrganization } from "@/modules/admin/actions"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  FormCard,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAdminData } from "@/modules/admin/data"

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { isSuperAdmin, organizations } = await getAdminData()
  const q = (await searchParams).q?.trim() ?? ""
  const filteredOrganizations = organizations.filter((organization) =>
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
      <SearchForm q={q} placeholder="Search organizations..." />
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
        headers={["Name", "Slug", "Type", "Status", "Edit"]}
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
              <OrganizationForm organization={organization} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function OrganizationForm({
  organization,
}: {
  organization?: {
    id: string
    name: string
    institutionType: InstitutionType
    isActive: boolean
    logoFileAsset?: { id: string } | null
  }
}) {
  return (
    <FormCard title={organization ? "Edit organization" : "Create organization"}>
      <form action={saveOrganization} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input name="id" type="hidden" value={organization?.id ?? ""} />
        {organization ? (
          <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-4">
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
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="name"
            defaultValue={organization?.name ?? ""}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Type</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
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
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Organization logo</span>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium"
            name="logo"
            type="file"
          />
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={organization?.isActive ?? true}
          />
          Active
        </label>
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
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
