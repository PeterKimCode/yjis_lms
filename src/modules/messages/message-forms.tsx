"use client"

import { useActionState, useMemo, useState } from "react"

import { ActionFeedback } from "@/components/action-feedback"
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
  const availableModes = useMemo(() => {
    const modes: Array<{
      label: string
      value: "CLASS_SECTION" | "DIRECT" | "PARENT_TEACHER"
    }> = []
    if (directOptions.some((option) => option.type === "DIRECT")) {
      modes.push({ label: "DM", value: "DIRECT" })
    }
    if (directOptions.some((option) => option.type === "PARENT_TEACHER")) {
      modes.push({ label: "Parent", value: "PARENT_TEACHER" })
    }
    if (classGroupOptions.length) {
      modes.push({ label: "Class group", value: "CLASS_SECTION" })
    }
    return modes
  }, [classGroupOptions.length, directOptions])
  const currentMode = availableModes.some((item) => item.value === mode)
    ? mode
    : availableModes[0]?.value ?? "DIRECT"
  const filteredRecipients = useMemo(
    () => directOptions.filter((option) => option.type === currentMode),
    [directOptions, currentMode]
  )
  const selectedRecipient = filteredRecipients.find(
    (option) =>
      `${option.type}:${option.userId}:${option.classSectionId}` === recipientKey
  )
  const recipientLabel =
    currentMode === "PARENT_TEACHER"
      ? filteredRecipients.some((option) => option.targetKind === "PARENT")
        ? "Parent"
        : "Teacher"
      : "Recipient"
  const recipientPlaceholder =
    currentMode === "PARENT_TEACHER"
      ? filteredRecipients.some((option) => option.targetKind === "PARENT")
        ? "Select a parent"
        : "Select a teacher"
      : "Select a student or teacher"

  return (
    <details className="rounded-xl border bg-white/90 p-4 shadow-sm" open>
      <summary className="cursor-pointer text-sm font-medium">
        New message
      </summary>
      <form action={formAction} className="grid gap-3 pt-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Conversation type</span>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            name="mode"
            value={currentMode}
            onChange={(event) => {
              setMode(event.target.value as typeof mode)
              setRecipientKey("")
            }}
            required
          >
            {availableModes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {!availableModes.length ? (
            <span className="text-xs text-muted-foreground">
              No conversation types are available for your account.
            </span>
          ) : null}
        </label>

        {currentMode === "CLASS_SECTION" ? (
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
                  {currentMode === "PARENT_TEACHER"
                    ? "No parents are available to message."
                    : "No direct recipients are available for your role."}
                </span>
              ) : null}
            </label>
          </>
        )}

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Message</span>
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
        <ActionFeedback state={state} />
        <div>
          <Button size="sm" type="submit" disabled={!availableModes.length}>
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
    <form
      action={formAction}
      className="lms-soft-panel grid gap-3 rounded-2xl p-4 shadow-sm"
    >
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
      <ActionFeedback state={state} />
      <div>
        <Button size="sm" type="submit">
          Send
        </Button>
      </div>
    </form>
  )
}

export function EditMessageForm({ body, conversationId, messageId, children }: {
  body: string; conversationId: string; messageId: string; children?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  if (!editing) return <><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{body}</p>
    <div className="mt-2 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900" onClick={() => { setError(""); setEditing(true) }}>Edit</Button>{children}</div></>
  return <form className="mt-2 grid gap-2" action={async (data) => {
    setPending(true)
    try { const result = await editMessage(initialMessageActionState, data); if (result.ok) setEditing(false); else setError(result.message) }
    catch { setError("Could not save the message. Please try again.") }
    finally { setPending(false) }
  }}>
    <input name="conversationId" type="hidden" value={conversationId} /><input name="messageId" type="hidden" value={messageId} />
    <textarea autoFocus aria-label="Edit message" name="body" defaultValue={body} required maxLength={MESSAGE_BODY_MAX_LENGTH} disabled={pending} className="min-h-24 w-full min-w-0 rounded-md border bg-white p-2 text-sm text-slate-900" />
    {error ? <p role="alert" className="text-sm text-white">{error}</p> : null}
    <div className="flex gap-2"><Button type="submit" size="sm" variant="outline" disabled={pending} className="bg-white text-slate-900 hover:bg-slate-100">{pending ? "Saving..." : "Save"}</Button><Button type="button" size="sm" variant="outline" disabled={pending} className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => setEditing(false)}>Cancel</Button></div>
  </form>
}
