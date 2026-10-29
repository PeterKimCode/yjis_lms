"use client"

import { usePathname } from "next/navigation"

export function SiteFooter() {
  const isLogin = usePathname() === "/login"
  return (
    <footer className={`bg-[#2F3A3F] px-4 py-6 text-sm text-[#F7E7C6] ${isLogin ? "" : "md:pl-72"}`}>
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <p className="text-base font-semibold">Learning Management System</p>
        <p><span className="font-semibold">Email:</span> <a className="underline underline-offset-4 hover:text-white" href="mailto:schoolyoungji@gmail.com">schoolyoungji@gmail.com</a></p>
        <p className="border-t border-[#596469] pt-4 text-xs leading-relaxed">&copy; 2026 Youngji International School. All rights reserved.</p>
      </div>
    </footer>
  )
}
