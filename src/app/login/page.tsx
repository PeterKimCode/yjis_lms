import Image from "next/image"
import { redirect } from "next/navigation"
import type { CSSProperties } from "react"

import { LoginForm } from "@/modules/auth/login-form"
import { getPostLoginPath } from "@/modules/auth/roles"
import { getCurrentSession } from "@/modules/auth/session"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const session = await getCurrentSession()
  const params = await searchParams

  if (session?.user?.id) {
    redirect(getPostLoginPath(session.user.roleAssignments))
  }

  return (
    <main className="app-shell-surface min-h-[calc(100vh-4rem)] px-4 py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6 lg:mx-0">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Log In</h1>
            <p className="text-sm text-muted-foreground">
              Use a school-managed account to access the LMS.
            </p>
          </div>
          <LoginForm
            callbackUrl="/login/redirect"
            hasError={params.error === "CredentialsSignin"}
          />
        </div>
        <LoginHeroSlider />
      </div>
    </main>
  )
}

function LoginHeroSlider() {
  const slides = [
    {
      eyebrow: "LMS workspace",
      title: "Manage learning in one place",
      body: "Classes, attendance, assignments, quizzes, grades, documents, messages, and notifications stay connected.",
    },
    {
      eyebrow: "Student progress",
      title: "See what needs attention",
      body: "Teachers and admins can review attendance, lesson progress, submissions, and final grade status quickly.",
    },
    {
      eyebrow: "School communication",
      title: "Keep everyone aligned",
      body: "Boards, direct messages, notifications, report cards, and transcripts support daily school operations.",
    },
  ]

  return (
    <section className="relative hidden min-h-[520px] overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950 p-8 text-white shadow-xl shadow-slate-200/70 lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(59,130,246,0.42),transparent_26rem),radial-gradient(circle_at_80%_12%,rgba(20,184,166,0.34),transparent_20rem)]" />
      <div className="relative z-10 flex h-full min-h-[456px] flex-col justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white">
            <Image
              alt="Learning Management System logo"
              className="h-14 w-14 rounded-full object-contain"
              height={56}
              src="/brand/gtcc-logo.png"
              width={56}
              loading="eager"
            />
          </span>
          <div>
            <p className="text-sm font-semibold text-sky-200">
              Learning Management System
            </p>
            <p className="text-xs text-slate-300">School LMS workspace</p>
          </div>
        </div>

        <div className="login-slide-window">
          {slides.map((slide, index) => (
            <div
              className="login-slide-card"
              key={slide.title}
              style={{ "--slide-index": index } as CSSProperties}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-200">
                {slide.eyebrow}
              </p>
              <h2 className="mt-3 max-w-md text-4xl font-bold leading-tight">
                {slide.title}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-200">
                {slide.body}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["Courses", "Attendance", "Grades"].map((label) => (
            <div
              className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur"
              key={label}
            >
              <p className="text-xs text-slate-300">{label}</p>
              <p className="mt-2 text-lg font-semibold">Ready</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
