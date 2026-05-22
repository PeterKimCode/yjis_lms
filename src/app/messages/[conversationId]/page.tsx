import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/modules/dashboards/components"
import { deleteMessage } from "@/modules/messages/actions"
import { getConversationDetail } from "@/modules/messages/data"
import {
  EditMessageForm,
  MessageComposer,
} from "@/modules/messages/message-forms"

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const data = await getConversationDetail(conversationId)

  if (!data) notFound()

  const { conversation, displayTitle, typeLabel, user } = data

  return (
    <main className="app-shell-surface flex-1 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/messages">Back to messages</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {displayTitle}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge label={typeLabel} value={conversation.type} />
              {conversation.classSection
                ? ` · ${conversation.classSection.course.title} · ${conversation.classSection.name}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {conversation.participants.map((participant) => (
              <span
                className="rounded-md border border-slate-200 bg-white/80 px-2 py-1"
                key={participant.id}
              >
                {participant.user.name ?? participant.user.email}
              </span>
            ))}
          </div>
        </div>

        <section className="lms-soft-panel space-y-3 rounded-lg p-4">
          {conversation.messages.length ? (
            conversation.messages.map((message) => {
              const own = message.senderId === user.id

              return (
                <div
                  className={`flex ${own ? "justify-end" : "justify-start"}`}
                  key={message.id}
                >
                  <article
                    className={`max-w-[80%] rounded-lg border p-3 shadow-sm ${
                      own
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-muted/50"
                    }`}
                  >
                    <p className="text-xs opacity-80">
                      {message.sender?.name ?? "Unknown"} ·{" "}
                      {formatDate(message.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p>
                    {own ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <EditMessageForm
                          body={message.body}
                          conversationId={conversation.id}
                          messageId={message.id}
                        />
                        <form action={deleteMessage}>
                          <input
                            name="conversationId"
                            type="hidden"
                            value={conversation.id}
                          />
                          <input name="messageId" type="hidden" value={message.id} />
                          <Button size="sm" type="submit" variant="destructive">
                            Delete
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          )}
        </section>

        <MessageComposer conversationId={conversation.id} />
      </div>
    </main>
  )
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}
