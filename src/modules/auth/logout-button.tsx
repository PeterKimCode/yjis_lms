"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"

export function LogoutButton() {
  return (
    <Button
      className="w-full"
      type="button"
      variant="outline"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut />
      Sign out
    </Button>
  )
}
