"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Eye, EyeOff, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const lockedMessage =
  "This account is temporarily locked because there were too many failed login attempts. Please wait 15 minutes or contact an administrator."
const loginErrorMessages: Record<string, string> = {
  AccountInactive:
    "This account is inactive. Please contact an administrator.",
  AccountLocked: lockedMessage,
  AccountNotConfigured:
    "This account does not have a login password configured. Please contact an administrator.",
  OrganizationUnavailable:
    "This account's organization is unavailable. Please contact an administrator to move the account to an active organization.",
}

export function LoginForm({
  callbackUrl,
  hasError,
  initialMessage,
}: {
  callbackUrl: string
  hasError: boolean
  initialMessage?: string
}) {
  const [error, setError] = useState(
    initialMessage ?? (hasError ? "Invalid login ID or password." : "")
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      callbackUrl,
      redirect: false,
    })

    setIsSubmitting(false)

    if (result?.ok && result.url) {
      window.location.assign(result.url)
      return
    }

    if (result?.error && loginErrorMessages[result.error]) {
      const message = loginErrorMessages[result.error]
      setError(message)
      window.dispatchEvent(
        new CustomEvent("lms-toast", {
          detail: { message, tone: "error" },
        })
      )
      return
    }

    const message = "Invalid login ID or password."
    setError(message)
    window.dispatchEvent(
      new CustomEvent("lms-toast", {
        detail: { message, tone: "error" },
      })
    )
  }

  return (
    <Card>
      <form action="/login" method="post" onSubmit={handleSubmit}>
        <CardContent className="space-y-5 pt-6 pb-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Login ID
            </label>
            <Input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="pr-12"
              />
              <Button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1 h-8 w-8 p-0"
                type="button"
                variant="ghost"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-3 pt-4">
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            <LogIn />
            {isSubmitting ? "Logging in..." : "Log In"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
