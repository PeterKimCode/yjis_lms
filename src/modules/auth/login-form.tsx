"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function LoginForm({
  callbackUrl,
  hasError,
}: {
  callbackUrl: string
  hasError: boolean
}) {
  const [error, setError] = useState(
    hasError ? "Invalid email or password." : ""
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    setError("Invalid email or password.")
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Demo: student@demo.local / DemoPass123!
        </p>
      </CardHeader>
      <form action="/login" method="post" onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue="student@demo.local"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue="DemoPass123!"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            <LogIn />
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
