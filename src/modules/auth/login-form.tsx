"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Eye, EyeOff, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const demoAccounts = [
  ["Super Admin", "super.admin@demo.local"],
  ["School Admin", "school.admin@demo.local"],
  ["Instructor", "instructor@demo.local"],
  ["Student", "student@demo.local"],
  ["Parent", "parent@demo.local"],
] as const

const demoPassword = "DemoPass123!"

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
  const [email, setEmail] = useState("student@demo.local")
  const [password, setPassword] = useState(demoPassword)
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

    setError("Invalid email or password.")
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Demo accounts use password {demoPassword}.</p>
          <div className="space-y-2">
            {demoAccounts.map(([label, accountEmail]) => (
              <div
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                key={accountEmail}
              >
                <span>
                  <span className="font-medium text-foreground">{label}:</span>{" "}
                  {accountEmail}
                </span>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEmail(accountEmail)
                    setPassword(demoPassword)
                    setError("")
                  }}
                >
                  Use
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <form action="/login" method="post" onSubmit={handleSubmit}>
        <CardContent className="space-y-5 pb-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
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
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
