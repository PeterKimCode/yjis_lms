export default function Loading() {
  return (
    <main className="app-shell-surface flex-1 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="lms-soft-panel rounded-xl p-5">
          <div className="h-1.5 w-16 animate-pulse rounded-full bg-primary/30" />
          <div className="mt-4 h-8 w-64 max-w-full animate-pulse rounded-md bg-slate-200" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-md bg-slate-100" />
        </section>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="rounded-xl border border-slate-200 bg-white/85 p-5 shadow-sm"
              key={index}
            >
              <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
              <div className="mt-6 h-8 w-20 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-3 w-36 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="grid grid-cols-4 gap-3" key={index}>
                <div className="h-4 animate-pulse rounded bg-slate-100" />
                <div className="h-4 animate-pulse rounded bg-slate-100" />
                <div className="h-4 animate-pulse rounded bg-slate-100" />
                <div className="h-4 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
