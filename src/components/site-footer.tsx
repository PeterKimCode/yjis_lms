import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/90 px-4 py-5 text-sm text-muted-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">YJIS LMS</p>
          <p className="text-xs">
            Local-first school learning, attendance, grades, and communication.
          </p>
        </div>
        <nav className="flex flex-wrap gap-3 text-xs">
          <Link className="hover:text-foreground" href="/messages">
            Messages
          </Link>
          <Link className="hover:text-foreground" href="/notifications">
            Notifications
          </Link>
          <Link className="hover:text-foreground" href="/">
            Home
          </Link>
        </nav>
      </div>
    </footer>
  )
}
