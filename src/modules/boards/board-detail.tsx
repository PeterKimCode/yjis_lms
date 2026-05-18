import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createComment, createPost } from "@/modules/boards/actions"
import { boardKindHelp } from "@/modules/boards/constants"
import { getBoardDetail } from "@/modules/boards/data"
import {
  EmptyState,
  SectionBlock,
} from "@/modules/dashboards/components"

export async function BoardDetailPage({
  boardId,
  backHref,
  q = "",
}: {
  boardId: string
  backHref: string
  q?: string
}) {
  const data = await getBoardDetail(boardId, q)

  if (!data) {
    notFound()
  }

  const { board, settings } = data

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild size="sm" variant="outline">
          <Link href={backHref}>Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{board.name}</h1>
          <p className="text-sm text-muted-foreground">
            {board.description || boardKindHelp(settings.boardKind)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-md border bg-background px-2 py-1">
            {data.boardKindLabel}
          </span>
          <span className="rounded-md border bg-background px-2 py-1">
            {board.classSection
              ? `${board.classSection.name} (${board.classSection.course.title})`
              : board.campus
                ? `${board.campus.name} campus`
                : `${board.organization.name} organization`}
          </span>
          <span className="rounded-md border bg-background px-2 py-1">
            Student posts: {settings.allowStudentPosts ? "On" : "Off"}
          </span>
          <span className="rounded-md border bg-background px-2 py-1">
            Parent posts: {settings.allowParentPosts ? "On" : "Off"}
          </span>
          <span className="rounded-md border bg-background px-2 py-1">
            Comments: {settings.allowComments ? "On" : "Off"}
          </span>
        </div>
      </div>

      {data.canPost ? (
        <details className="rounded-lg border bg-background p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Create post
          </summary>
          <form action={createPost} className="grid gap-3 pt-3">
            <input name="boardId" type="hidden" value={board.id} />
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Title</span>
              <Input
                maxLength={200}
                name="title"
                placeholder="Example: Welcome to this board"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Content</span>
              <textarea
                className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm"
                maxLength={10000}
                name="body"
                placeholder="Write the announcement, question, or discussion post."
                required
              />
            </label>
            {data.canManage ? (
              <label className="flex items-center gap-2 text-sm">
                <input name="isPinned" type="checkbox" />
                Pin post
              </label>
            ) : null}
            <div>
              <Button size="sm" type="submit">
                Publish post
              </Button>
            </div>
          </form>
        </details>
      ) : (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          Announcements are read-only for you unless posting is enabled.
        </p>
      )}

      <SectionBlock title="Posts">
        <div className="space-y-4">
          <form className="flex flex-col gap-2 sm:flex-row" action="">
            <Input
              className="sm:max-w-sm"
              name="q"
              placeholder="Search posts..."
              defaultValue={q}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                Search
              </Button>
              {q ? (
                <Button asChild type="button" variant="ghost">
                  <Link href="?">Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>
          {board.posts.length ? (
            <div className="space-y-3">
              {board.posts.map((post) => (
                <article
                  className="rounded-lg border bg-background p-4"
                  key={post.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-semibold">{post.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {post.author?.name ?? "Unknown author"} ·{" "}
                        {formatDate(post.createdAt)}
                        {post.isPinned ? " · Pinned" : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {post._count.comments} comments
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>
                  <details className="mt-4 rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Comments
                    </summary>
                    <div className="space-y-3 pt-3">
                      {post.comments.length ? (
                        post.comments.map((comment) => (
                          <div className="rounded-md bg-muted/40 p-3" key={comment.id}>
                            <p className="whitespace-pre-wrap text-sm">
                              {comment.body}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {comment.author?.name ?? "Unknown author"} ·{" "}
                              {formatDate(comment.createdAt)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <EmptyState>No comments yet.</EmptyState>
                      )}
                      {data.canComment ? (
                        <form action={createComment} className="grid gap-2">
                          <input name="postId" type="hidden" value={post.id} />
                          <textarea
                            className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                            maxLength={3000}
                            name="body"
                            placeholder="Add a comment."
                            required
                          />
                          <div>
                            <Button size="sm" type="submit" variant="outline">
                              Add comment
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Comments are disabled or unavailable for your account.
                        </p>
                      )}
                    </div>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState>No posts yet.</EmptyState>
          )}
        </div>
      </SectionBlock>
    </div>
  )
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}
