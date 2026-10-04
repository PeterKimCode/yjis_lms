export const draftPrefix = "lms:draft:v1:"
export const draftLifetime = 7 * 24 * 60 * 60 * 1000

export function clearUserDrafts(userId: string | undefined) {
  if (!userId) return
  window.dispatchEvent(new Event("lms-clear-drafts"))
  try {
    const prefix = `${draftPrefix}${encodeURIComponent(userId)}:`
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) localStorage.removeItem(key)
    }
  } catch { /* Storage may be disabled. Logout must still work. */ }
}
