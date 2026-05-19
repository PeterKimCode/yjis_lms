import Link from "next/link"

import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/modules/dashboards/components"
import { getConversationList, getConversationStartOptions } from "@/modules/messages/data"
import { NewMessageForm } from "@/modules/messages/message-forms"

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const params = await searchParams
  const [{ conversations, filter, q, user }, options] = await Promise.all([
    getConversationList({ filter: params.filter ?? "all", q: params.q ?? "" }),
    getConversationStartOptions(),
  ])

  return (
    <main className="flex-1 bg-muted/40 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Button asChild size="sm" variant="outline">
          <Link href={getDashboardHref(user.roleAssignments.map((item) => item.role))}>
            Back
          </Link>
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Text-only LMS conversations with teachers, students, parents, and
            class groups.
          </p>
        </div>

        <NewMessageForm
          classGroupOptions={options.classGroupOptions}
          directOptions={options.directOptions}
        />

        <form className="flex flex-col gap-2 rounded-lg border bg-background p-4 md:flex-row">
          <input
            className="h-9 rounded-md border bg-background px-3 text-sm md:max-w-sm"
            defaultValue={q}
            name="q"
            placeholder="Search conversations..."
          />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue={filter}
            name="filter"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="DIRECT">Direct</option>
            <option value="CLASS_SECTION">Class groups</option>
            <option value="SUPPORT">Support</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Filter
            </Button>
            <Button asChild type="button" variant="ghost">
              <Link href="/messages">Reset</Link>
            </Button>
          </div>
        </form>

        {conversations.length ? (
          <div className="grid gap-3">
            {conversations.map((conversation) => {
              const lastMessage = conversation.messages[0]

              return (
                <Link
                  className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted/60"
                  href={`/messages/${conversation.id}`}
                  key={conversation.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{conversation.displayTitle}</h2>
                        <StatusBadge
                          label={conversation.typeLabel}
                          value={conversation.type}
                        />
                        {conversation.unreadCount ? (
                          <StatusBadge
                            label={`${conversation.unreadCount} unread`}
                            value="PENDING"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {lastMessage
                          ? `${lastMessage.sender?.name ?? "Unknown"}: ${lastMessage.body}`
                          : "No messages yet."}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {conversation.classSection
                          ? `${conversation.classSection.course.title} · ${conversation.classSection.name}`
                          : `${conversation.participants.length} participants`}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(lastMessage?.createdAt ?? conversation.updatedAt)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-background p-8 text-center text-sm text-muted-foreground">
            No conversations yet.
          </div>
        )}
      </div>
    </main>
  )
}

function getDashboardHref(roles: string[]) {
  if (
    roles.some((role) =>
      ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "ACADEMIC_STAFF"].includes(
        role
      )
    )
  ) {
    return "/admin"
  }
  if (roles.some((role) => ["INSTRUCTOR", "HOMEROOM_TEACHER"].includes(role))) {
    return "/instructor"
  }
  if (roles.includes("STUDENT")) return "/student"
  if (roles.includes("PARENT")) return "/parent"

  return "/"
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}
