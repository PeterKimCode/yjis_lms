"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"

import { useAssessmentSave } from "@/components/assessment-save"

import { ActionFeedback } from "@/components/action-feedback"

import { manageAssessmentAttachment } from "./assessment-attachment-actions"

import { initialQuizActionState } from "@/modules/quizzes/action-state"

export function AssessmentAttachments({
  attachments,
  kind,
  ownerId
}: {
  attachments: { id: string; name: string }[]
  kind?: "assignment" | "quiz"
  ownerId?: string
}) {
  return (
    <div className="space-y-3 text-sm">
      {attachments.length ? (
        attachments.map((file) => (
          <Attachment key={file.id} file={file} kind={kind} ownerId={ownerId} />
        ))
      ) : (
        <p className="text-muted-foreground">No attachments.</p>
      )}
    </div>
  )
}

function Attachment({
  file,
  kind,
  ownerId
}: {
  file: { id: string; name: string }
  kind?: "assignment" | "quiz"
  ownerId?: string
}) {
  const [replace, setReplace] = useState(false)

  const { state, pending, onSubmit } = useAssessmentSave(
    manageAssessmentAttachment,
    initialQuizActionState
  )

  return (
    <article className="min-w-0 rounded-lg border bg-background p-3 space-y-3">
      <p className="break-all font-medium">{file.name}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a
            href={`/api/files/${file.id}/download?disposition=inline`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View
          </a>
        </Button>

        <Button asChild variant="outline" size="sm">
          <a href={`/api/files/${file.id}/download`}>Download</a>
        </Button>

        {kind && ownerId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setReplace((v) => !v)}
          >
            Replace
          </Button>
        ) : null}
      </div>

      {file.name.toLowerCase().endsWith(".pdf") ? (
        <details>
          <summary className="cursor-pointer font-medium">
            Read PDF here
          </summary>
          <iframe
            title={`PDF: ${file.name}`}
            src={`/api/files/${file.id}/download?disposition=inline`}
            className="mt-3 h-[420px] w-full rounded border"
            loading="lazy"
          />
        </details>
      ) : null}
      {kind && ownerId ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            if (!replace && !window.confirm("Remove this attachment?")) {
              event.preventDefault()
              return
            }
            void onSubmit(event)
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="ownerId" value={ownerId} />
          <input type="hidden" name="fileAssetId" value={file.id} />
          <input
            type="hidden"
            name="operation"
            value={replace ? "replace" : "delete"}
          />

          {replace ? (
            <>
              <label className="grid gap-1">
                <span>Replacement PDF</span>
                <Input
                  name="replacementFile"
                  type="file"
                  accept=".pdf,application/pdf"
                  required
                  disabled={pending}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                PDF only. Max 20MB. The current file stays until replacement
                succeeds.
              </p>
            </>
          ) : null}

          <Button
            type="submit"
            size="sm"
            variant={replace ? "default" : "outline"}
            className={
              !replace ? "border-red-200 text-red-700 hover:bg-red-50" : ""
            }
            disabled={pending}
          >
            {pending ? "Saving…" : replace ? "Upload replacement" : "Delete"}
          </Button>
          <ActionFeedback state={state} />
        </form>
      ) : null}
    </article>
  )
}
