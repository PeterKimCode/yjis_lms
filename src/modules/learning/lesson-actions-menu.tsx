"use client"

import { useRef, useState, type ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { updateLessonQuickly } from "./actions"

export function LessonActionsMenu({ classSectionId, lessonId, title, edit, preview }: {
  classSectionId: string
  lessonId: string
  title: string
  edit: ReactNode
  preview: ReactNode
}) {
  const [dialog, setDialog] = useState<"edit" | "preview" | null>(null)
  const [pending, setPending] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const content = useRef<HTMLDivElement>(null)
  async function duplicate() {
    setPending(true)
    try {
      await updateLessonQuickly(classSectionId, lessonId, "duplicate")
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Lesson copied as draft.", tone: "success" } }))
    } catch {
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Could not copy lesson. Please try again.", tone: "error" } }))
    } finally { setPending(false) }
  }
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={trigger} type="button" size="icon" variant="ghost" aria-label={`More actions for ${title}`} disabled={pending}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onCloseAutoFocus={(event) => { if (dialog) event.preventDefault() }}>
        <DropdownMenuItem onSelect={() => setDialog("edit")}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setDialog("preview")}>Student preview</DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => { void duplicate() }}>Duplicate lesson</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) { for (const form of content.current?.querySelectorAll("form") ?? []) { if (!form.dispatchEvent(new CustomEvent("lms-confirm-leave", { cancelable: true, detail: { proceed: () => setDialog(null) } }))) return }; setDialog(null) } }}>
      <DialogContent ref={content} aria-describedby={undefined} className="sm:max-w-3xl lg:max-w-5xl" onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus() }}>
        <DialogHeader className="pr-10"><DialogTitle>{dialog === "edit" ? `Edit lesson: ${title}` : title}</DialogTitle></DialogHeader>
        {dialog === "edit" ? edit : dialog === "preview" ? preview : null}
      </DialogContent>
    </Dialog>
  </>
}
