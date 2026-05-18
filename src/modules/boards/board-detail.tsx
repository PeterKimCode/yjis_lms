import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createComment,
  createPost,
  deleteComment,
  deleteCommentAttachment,
  deletePost,
  deletePostAttachment,
  updateComment,
  updatePost,
} from "@/modules/boards/actions"
import { boardKindHelp } from "@/modules/boards/constants"
import { getBoardDetail } from "@/modules/boards/data"
import { EmptyState, SectionBlock } from "@/modules/dashboards/components"

export async function BoardDetailPage({
  backHref,
  boardId,
  expectedClassSectionId,
  query = {},
}: {
  backHref: string
  boardId: string
  expectedClassSectionId?: string
  query?: { pinned?: string; q?: string; status?: string }
}) {
  const data = await getBoardDetail(boardId, query)

  if (
    !data ||
    (expectedClassSectionId &&
      data.board.classSectionId !== expectedClassSectionId)
  ) {
    notFound()
  }

  const { board, settings } = data

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
        <details className="rounded-lg border bg-background p-4" open>
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
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Images</span>
              <input
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                name="images"
                type="file"
              />
              <span className="text-xs text-muted-foreground">
                Upload JPG, PNG, WEBP, or GIF images. Maximum 10MB per image.
              </span>
            </label>
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
          <form className="grid gap-2 md:grid-cols-4" action="">
            <Input
              name="q"
              placeholder="Search posts..."
              defaultValue={query.q ?? ""}
            />
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              name="pinned"
              defaultValue={query.pinned ?? "all"}
            >
              <option value="all">All posts</option>
              <option value="pinned">Pinned only</option>
              <option value="normal">Not pinned</option>
            </select>
            {data.canManage ? (
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                name="status"
                defaultValue={query.status ?? "published"}
              >
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
                <option value="all">All statuses</option>
              </select>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                Search
              </Button>
              {query.q || query.pinned || query.status ? (
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
                        {post.publishedAt ? "" : " · Unpublished"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {post._count.comments} comments
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p>
                  <ImageGrid
                    attachments={post.attachments}
                    boardId={board.id}
                    canRemove={data.canManage || post.authorId === data.user?.id}
                    type="post"
                  />
                  {data.canManage || post.authorId === data.user?.id ? (
                    <details className="mt-4 rounded-md border p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Edit post
                      </summary>
                      <form action={updatePost} className="grid gap-3 pt-3">
                        <input name="boardId" type="hidden" value={board.id} />
                        <input name="postId" type="hidden" value={post.id} />
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Title</span>
                          <Input
                            maxLength={200}
                            name="title"
                            defaultValue={post.title}
                            required
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Content</span>
                          <textarea
                            className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
                            maxLength={10000}
                            name="body"
                            defaultValue={post.body}
                            required
                          />
                        </label>
                        {data.canManage ? (
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                name="isPinned"
                                type="checkbox"
                                defaultChecked={post.isPinned}
                              />
                              Pin post
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                name="isPublished"
                                type="checkbox"
                                defaultChecked={Boolean(post.publishedAt)}
                              />
                              Published
                            </label>
                          </div>
                        ) : null}
                        <label className="grid gap-1 text-sm">
                          <span className="font-medium">Add images</span>
                          <input
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            multiple
                            name="images"
                            type="file"
                          />
                          <span className="text-xs text-muted-foreground">
                            Up to 5 images per post. JPG, PNG, WEBP, or GIF
                            only. Maximum 10MB per image.
                          </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" type="submit">
                            Save post
                          </Button>
                          <Button
                            form={`delete-post-${post.id}`}
                            size="sm"
                            type="submit"
                            variant="destructive"
                          >
                            Delete post
                          </Button>
                        </div>
                      </form>
                      <form action={deletePost} id={`delete-post-${post.id}`}>
                        <input name="boardId" type="hidden" value={board.id} />
                        <input name="postId" type="hidden" value={post.id} />
                      </form>
                    </details>
                  ) : null}
                  <details className="mt-4 rounded-md border p-3" open>
                    <summary className="cursor-pointer text-sm font-medium">
                      Comments
                    </summary>
                    <div className="space-y-3 pt-3">
                      {settings.allowComments ? null : (
                        <p className="text-xs text-muted-foreground">
                          Comments are disabled for this board.
                        </p>
                      )}
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
                            <ImageGrid
                              attachments={comment.attachments}
                              canRemove={
                                data.canManage ||
                                comment.authorId === data.user?.id
                              }
                              type="comment"
                            />
                            {data.canManage || comment.authorId === data.user?.id ? (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-medium">
                                  Edit comment
                                </summary>
                                <form
                                  action={updateComment}
                                  className="mt-2 grid gap-2"
                                >
                                  <input
                                    name="commentId"
                                    type="hidden"
                                    value={comment.id}
                                  />
                                  <input
                                    name="postId"
                                    type="hidden"
                                    value={post.id}
                                  />
                                  <textarea
                                    className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm"
                                    maxLength={3000}
                                    name="body"
                                    defaultValue={comment.body}
                                    required
                                  />
                                  <label className="grid gap-1 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                      Replace image
                                    </span>
                                    <input
                                      accept="image/jpeg,image/png,image/webp,image/gif"
                                      name="image"
                                      type="file"
                                    />
                                    Optional image. JPG, PNG, WEBP, or GIF.
                                    Maximum 10MB.
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" type="submit" variant="outline">
                                      Save comment
                                    </Button>
                                    <Button
                                      form={`delete-comment-${comment.id}`}
                                      size="sm"
                                      type="submit"
                                      variant="destructive"
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </form>
                                <form
                                  action={deleteComment}
                                  id={`delete-comment-${comment.id}`}
                                >
                                  <input
                                    name="commentId"
                                    type="hidden"
                                    value={comment.id}
                                  />
                                </form>
                              </details>
                            ) : null}
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
                          <label className="grid gap-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Image
                            </span>
                            <input
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              name="image"
                              type="file"
                            />
                            Optional image. JPG, PNG, WEBP, or GIF. Maximum
                            10MB.
                          </label>
                          <div>
                            <Button size="sm" type="submit" variant="outline">
                              Add comment
                            </Button>
                          </div>
                        </form>
                      ) : null}
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
    </main>
  )
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

function ImageGrid({
  attachments,
  boardId,
  canRemove,
  type,
}: {
  attachments: {
    id: string
    fileAsset: {
      id: string
      originalName: string
    }
  }[]
  boardId?: string
  canRemove: boolean
  type: "comment" | "post"
}) {
  if (!attachments.length) return null

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {attachments.map((attachment) => (
        <figure className="rounded-md border bg-muted/30 p-2" key={attachment.id}>
          <a
            href={`/api/files/${attachment.fileAsset.id}/download?disposition=inline`}
            rel="noreferrer"
            target="_blank"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={attachment.fileAsset.originalName}
              className="h-40 w-full rounded object-cover"
              src={`/api/files/${attachment.fileAsset.id}/download?disposition=inline`}
            />
          </a>
          <figcaption className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground">
            <span className="truncate" title={attachment.fileAsset.originalName}>
              {attachment.fileAsset.originalName}
            </span>
            {canRemove ? (
              <form
                action={
                  type === "post" ? deletePostAttachment : deleteCommentAttachment
                }
              >
                {type === "post" && boardId ? (
                  <input name="boardId" type="hidden" value={boardId} />
                ) : null}
                <input
                  name="attachmentId"
                  type="hidden"
                  value={attachment.id}
                />
                <Button size="sm" type="submit" variant="outline">
                  Remove image
                </Button>
              </form>
            ) : null}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
