import { Button } from "@/components/ui/button"
import {
  deleteAdminEntity,
  requestResourceDeletion,
  reviewResourceDeletionRequest,
} from "@/modules/admin/actions"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"

type ResourceDeletionEntity = "course" | "classSection"

export function ResourceDeletionStatusBanners({
  entityLabel,
  params,
}: {
  entityLabel: string
  params: {
    deleteRequested?: string
    requestError?: string
    reviewed?: string
    reviewError?: string
  }
}) {
  return (
    <div className="space-y-2">
      {params.deleteRequested ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {entityLabel} deletion request sent to super admins for approval.
        </div>
      ) : null}
      {params.requestError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not request {entityLabel} deletion. Check your scope or try again.
        </div>
      ) : null}
      {params.reviewed === "approved" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {entityLabel} deletion request approved and the record was deleted.
        </div>
      ) : null}
      {params.reviewed === "rejected" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {entityLabel} deletion request rejected.
        </div>
      ) : null}
      {params.reviewError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not review the {entityLabel} deletion request.
        </div>
      ) : null}
    </div>
  )
}

export function PendingResourceDeletionRequests({
  requests,
  returnPath,
  title,
}: {
  requests: Array<{
    id: string
    entityName: string
    organization: { name: string }
    requestedAt: Date
    requestedBy: { email: string | null; name: string } | null
  }>
  returnPath: string
  title: string
}) {
  if (!requests.length) return null

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="mb-3">
        <h2 className="font-semibold text-amber-950">{title}</h2>
        <p className="text-sm text-amber-800">
          Review requests from school admins before any record is deleted.
        </p>
      </div>
      <div className="grid gap-2">
        {requests.map((request) => (
          <div
            className="flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            key={request.id}
          >
            <div className="min-w-0">
              <p className="font-medium">{request.entityName}</p>
              <p className="text-sm text-muted-foreground">
                {request.organization.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Requested by {request.requestedBy?.name ?? "Unknown admin"} on{" "}
                {request.requestedAt.toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={reviewResourceDeletionRequest}>
                <input name="requestId" type="hidden" value={request.id} />
                <input name="decision" type="hidden" value="approve" />
                <input name="returnPath" type="hidden" value={returnPath} />
                <Button size="sm" type="submit" variant="destructive">
                  Approve delete
                </Button>
              </form>
              <form action={reviewResourceDeletionRequest}>
                <input name="requestId" type="hidden" value={request.id} />
                <input name="decision" type="hidden" value="reject" />
                <input name="returnPath" type="hidden" value={returnPath} />
                <Button size="sm" type="submit" variant="outline">
                  Reject
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ResourceDeleteControl({
  canDeleteDirectly,
  entity,
  id,
  isRequested,
  label,
  returnPath,
}: {
  canDeleteDirectly: boolean
  entity: ResourceDeletionEntity
  id: string
  isRequested: boolean
  label: string
  returnPath: string
}) {
  const entityLabel = entity === "course" ? "course" : "class section"

  if (canDeleteDirectly) {
    return (
      <ConfirmDeleteForm
        action={deleteAdminEntity}
        entity={entity}
        id={id}
        message={`Delete ${entityLabel} "${label}"? Related records may prevent deletion.`}
        returnPath={returnPath}
      />
    )
  }

  if (isRequested) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
        Delete requested
      </span>
    )
  }

  return (
    <ConfirmDeleteForm
      action={requestResourceDeletion}
      confirmLabel="Send request"
      entity={entity}
      id={id}
      label="Request delete"
      message={`Request super admin approval to delete ${entityLabel} "${label}"? It will not be deleted until a super admin approves.`}
      pendingLabel="Requesting..."
      returnPath={returnPath}
      title={`Request ${entityLabel} deletion?`}
      warning={`This sends an approval request only. A super admin must approve before the ${entityLabel} is deleted.`}
    />
  )
}
