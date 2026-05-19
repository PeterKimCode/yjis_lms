"use client"

import { useActionState, useMemo, useState } from "react"

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

type DirectOption = {
  classSectionId: string
  description: string
  label: string
  targetKind: "PARENT" | "STAFF" | "STUDENT" | "TEACHER"
  type: "DIRECT" | "PARENT_TEACHER"
  userId: string
}

export function NewMessageForm({
  classGroupOptions,
  directOptions,
}: {
  classGroupOptions: { id: string; label: string }[]
  directOptions: DirectOption[]
}) {
  const [state, formAction] = useActionState(
    startConversation,
    initialMessageActionState
  )
  const [mode, setMode] = useState<"CLASS_SECTION" | "DIRECT" | "PARENT_TEACHER">(
    "DIRECT"
  )
  const [recipientKey, setRecipientKey] = useState("")
  const filteredRecipients = useMemo(
    () => directOptions.filter((option) => option.type === mode),
    [directOptions, mode]
  )
  const selectedRecipient = filteredRecipients.find(
    (option) =>
      `${option.type}:${option.userId}:${option.classSectionId}` === recipientKey
  )
  const recipientLabel =
    mode === "PARENT_TEACHER"
      ? filteredRecipients.some((option) => option.targetKind === "PARENT")
        ? "Parent"
        : "Teacher"
      : "Recipient"
  const recipientPlaceholder =
    mode === "PARENT_TEACHER"
      ? filteredRecipients.some((option) => option.targetKind === "PARENT")
        ? "Select a parent"
        : "Select a teacher"
      : "Select a student or teacher"

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
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as typeof mode)
              setRecipientKey("")
            }}
            required
          >
            <option value="DIRECT">DM</option>
            <option value="PARENT_TEACHER">Parent</option>
            <option value="CLASS_SECTION">Class group</option>
          </select>
        </label>

        {mode === "CLASS_SECTION" ? (
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Class group</span>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              name="classSectionId"
              required
            >
              {classGroupOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {!classGroupOptions.length ? (
              <span className="text-xs text-muted-foreground">
                No class groups are available.
              </span>
            ) : null}
          </label>
        ) : (
          <>
            <input
              name="classSectionId"
              type="hidden"
              value={selectedRecipient?.classSectionId ?? ""}
            />
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{recipientLabel}</span>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                name="recipientUserId"
                value={recipientKey}
                onChange={(event) => setRecipientKey(event.target.value)}
                required
              >
                <option value="">
                  {recipientPlaceholder}
                </option>
                {filteredRecipients.map((option) => {
                  const key = `${option.type}:${option.userId}:${option.classSectionId}`

                  return (
                    <option key={key} value={key}>
                      {option.label} - {option.description}
                    </option>
                  )
                })}
              </select>
              {!filteredRecipients.length ? (
                <span className="text-xs text-muted-foreground">
                  {mode === "PARENT_TEACHER"
                    ? "No parents are available to message."
                    : "No direct recipients are available for your role."}
                </span>
              ) : null}
            </label>
          </>
        )}

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
