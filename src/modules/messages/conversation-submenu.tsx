import Link from "next/link"

import { StatusBadge } from "@/modules/dashboards/components"

type ConversationSummary = {
  displayTitle: string
  id: string
  messages: {
    body: string
    createdAt: Date
    sender: { name: string | null } | null
  }[]
  type: string
  typeLabel: string
  unreadCount: number
}

export function ConversationSubmenu({
  activeConversationId,
  conversations,
}: {
  activeConversationId?: string
  conversations: ConversationSummary[]
}) {
  return (
    <aside className="lms-soft-panel h-fit rounded-xl p-3 lg:sticky lg:top-24">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Message list</h2>
          <p className="text-xs text-muted-foreground">
            Recent conversations
          </p>
        </div>
        <StatusBadge label={String(conversations.length)} value="ACTIVE" />
      </div>
      <div className="grid max-h-[70vh] gap-2 overflow-y-auto pr-1">
        {conversations.length ? (
          conversations.map((conversation) => {
            const lastMessage = conversation.messages[0]
            const active = conversation.id === activeConversationId

            return (
              <Link
                className={`rounded-lg border p-3 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-slate-200 bg-white/80 hover:border-primary/40 hover:bg-white"
                }`}
                href={`/messages/${conversation.id}`}
                key={conversation.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">
                    {conversation.displayTitle}
                  </p>
                  {conversation.unreadCount ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {lastMessage
                    ? `${lastMessage.sender?.name ?? "User"}: ${lastMessage.body}`
                    : "No messages yet."}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {lastMessage ? formatDate(lastMessage.createdAt) : conversation.typeLabel}
                </p>
              </Link>
            )
          })
        ) : (
          <p className="rounded-lg border border-dashed bg-white/70 p-4 text-sm text-muted-foreground">
            No conversations yet.
          </p>
        )}
      </div>
    </aside>
  )
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}
