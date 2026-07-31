"use client"

import { deleteFileAssetAction } from "@/app/admin/files/actions"
import { Button } from "@/components/ui/button"

export function DeleteFileButton({
  fileId,
  fileName,
}: {
  fileId: string
  fileName: string
}) {
  return (
    <form
      action={deleteFileAssetAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete this file?\n\n${fileName}\n\nThis removes the file from the LMS and deletes the stored object. This action cannot be undone.`
        )

        if (!confirmed) {
          event.preventDefault()
        }
      }}
    >
      <input name="fileId" type="hidden" value={fileId} />
      <Button size="sm" type="submit" variant="destructive">
        Delete
      </Button>
    </form>
  )
}
