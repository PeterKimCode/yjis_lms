"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import {
  editMessage,
  sendMessage,
  startConversation,
} from "@/modules/messages/actions"
import {
  initialMessageActionState,
  MESSAGE_BODY_MAX_LENGTH,
} from "@/modules/messages/types"

export function NewMessageForm({
  classGroupOptions,
  directOptions,
}: {
  classGroupOptions: { id: string; label: string }[]
  directOptions: {
    classSectionId: string
    description: string
    label: string
    type: "DIRECT" | "PARENT_TEACHER"
    userId: string
  }[]
}) {
  const [state, formAction] = useActionState(
    startConversation,
    initialMessageActionState
  )

  return (
    <details className="rounded-lg border bg-background p-4" open>
      <summary className="cursor-pointer text-sm font-medium">
        New message
      </summary>
      <form action={formAction} className="grid gap-3 pt-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Conversation type</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            name="mode"
            required
          >
            <option value="DIRECT">Direct message</option>
            <option value="PARENT_TEACHER">Parent-teacher message</option>
            <option value="CLASS_SECTION">Class group</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Recipient</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            name="recipientUserId"
          >
            <option value="">None for class group</option>
            {directOptions.map((option) => (
              <option
                key={`${option.type}-${option.userId}-${option.classSectionId}`}
                value={option.userId}
              >
                {option.label} · {option.description}
              </option>
            ))}
          </select>
          {!directOptions.length ? (
            <span className="text-xs text-muted-foreground">
              No direct recipients are available for your role.
            </span>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Class section</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            name="classSectionId"
          >
            <option value="">No class context</option>
            {classGroupOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">First message</span>
          <textarea
            className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
            maxLength={MESSAGE_BODY_MAX_LENGTH}
            name="body"
            placeholder="Write a text message."
            required
          />
          <span className="text-xs text-muted-foreground">
            Text only. No image or file uploads in messenger.
          </span>
        </label>
        <ActionMessage state={state} />
        <div>
          <Button size="sm" type="submit">
            Start conversation
          </Button>
        </div>
      </form>
    </details>
  )
}

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [state, formAction] = useActionState(sendMessage, initialMessageActionState)

  return (
    <form action={formAction} className="grid gap-2 rounded-lg border bg-background p-4">
      <input name="conversationId" type="hidden" value={conversationId} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Message</span>
        <textarea
          className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
          maxLength={MESSAGE_BODY_MAX_LENGTH}
          name="body"
          placeholder="Write a text-only message."
          required
        />
        <span className="text-xs text-muted-foreground">
          Text only for now. Attachments are not enabled in messenger.
        </span>
      </label>
      <ActionMessage state={state} />
      <div>
        <Button size="sm" type="submit">
          Send
        </Button>
      </div>
    </form>
  )
}

export function EditMessageForm({
  body,
  conversationId,
  messageId,
}: {
  body: string
  conversationId: string
  messageId: string
}) {
  const [state, formAction] = useActionState(editMessage, initialMessageActionState)

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium">Edit</summary>
      <form action={formAction} className="mt-2 grid gap-2">
        <input name="conversationId" type="hidden" value={conversationId} />
        <input name="messageId" type="hidden" value={messageId} />
        <textarea
          className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm"
          maxLength={MESSAGE_BODY_MAX_LENGTH}
          name="body"
          defaultValue={body}
          required
        />
        <ActionMessage state={state} />
        <div>
          <Button size="sm" type="submit" variant="outline">
            Save
          </Button>
        </div>
      </form>
    </details>
  )
}

function ActionMessage({ state }: { state: { ok: boolean; message: string } }) {
  return state.message ? (
    <p
      className={`rounded-md border p-2 text-sm ${
        state.ok ? "text-muted-foreground" : "text-destructive"
      }`}
    >
      {state.message}
    </p>
  ) : null
}
