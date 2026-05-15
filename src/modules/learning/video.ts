export function parseYouTubeVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname.replace(/^www\./, "")

    if (host === "youtu.be") {
      return normalizeYouTubeId(parsedUrl.pathname.slice(1))
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsedUrl.pathname === "/watch") {
        return normalizeYouTubeId(parsedUrl.searchParams.get("v"))
      }

      if (
        parsedUrl.pathname.startsWith("/embed/") ||
        parsedUrl.pathname.startsWith("/shorts/")
      ) {
        return normalizeYouTubeId(parsedUrl.pathname.split("/")[2])
      }
    }
  } catch {
    return null
  }

  return null
}

export function isYouTubeUrl(url: string) {
  return parseYouTubeVideoId(url) !== null
}

function normalizeYouTubeId(value: string | null | undefined) {
  if (!value) return null
  const [id] = value.split(/[?&]/)

  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
}
