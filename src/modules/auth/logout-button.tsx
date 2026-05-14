"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { getCsrfToken, signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"

export function LogoutButton({
  className,
  size = "default",
}: {
  className?: string
  size?: React.ComponentProps<typeof Button>["size"]
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [csrfToken, setCsrfToken] = useState("")

  useEffect(() => {
    void getCsrfToken().then((token) => {
      setCsrfToken(token ?? "")
    })
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    const result = await signOut({
      callbackUrl: "/login",
      redirect: false,
    })

    window.location.replace(result.url || "/login")
  }

  return (
    <form action="/api/auth/signout" method="post" onSubmit={handleSubmit}>
      <input name="csrfToken" type="hidden" value={csrfToken} />
      <input name="callbackUrl" type="hidden" value="/login" />
      <Button
        className={className}
        type="submit"
        variant="outline"
        size={size}
        disabled={isSubmitting}
      >
        <LogOut />
        {isSubmitting ? "Signing out..." : "Logout"}
      </Button>
    </form>
  )
}
