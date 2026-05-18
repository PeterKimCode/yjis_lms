"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveBoard } from "@/modules/boards/actions"
import {
  BOARD_KIND_OPTIONS,
  type BoardKind,
  boardKindHelp,
  boardKindLabel,
  getBoardSettings,
  isClassBoardKind,
} from "@/modules/boards/constants"

type OrganizationOption = { id: string; label: string }
type CampusOption = { id: string; label: string; organizationId: string }
type ClassSectionOption = {
  id: string
  label: string
  organizationId: string
  campusId: string | null
}

type BoardFormValue = {
  id?: string
  organizationId?: string
  campusId?: string | null
  classSectionId?: string | null
  name?: string
  description?: string | null
  isActive?: boolean
  settings?: unknown
}

export function BoardForm({
  board,
  campusOptions,
  classSectionOptions,
  organizationOptions,
  submitLabel = "Save board",
}: {
  board?: BoardFormValue
  campusOptions: CampusOption[]
  classSectionOptions: ClassSectionOption[]
  organizationOptions: OrganizationOption[]
  submitLabel?: string
}) {
  const initialSettings = getBoardSettings(board?.settings)
  const [organizationId, setOrganizationId] = useState(
    board?.organizationId ?? organizationOptions[0]?.id ?? ""
  )
  const [campusId, setCampusId] = useState(board?.campusId ?? "")
  const [classSectionId, setClassSectionId] = useState(
    board?.classSectionId ?? ""
  )
  const [boardKind, setBoardKind] = useState<BoardKind>(
    initialSettings.boardKind
  )
  const [allowStudentPosts, setAllowStudentPosts] = useState(
    initialSettings.allowStudentPosts
  )
  const [allowParentPosts, setAllowParentPosts] = useState(
    initialSettings.allowParentPosts
  )
  const [allowComments, setAllowComments] = useState(
    initialSettings.allowComments
  )

  const filteredCampuses = useMemo(
    () =>
      campusOptions.filter((campus) => campus.organizationId === organizationId),
    [campusOptions, organizationId]
  )
  const filteredClassSections = useMemo(
    () =>
      classSectionOptions.filter(
        (section) =>
          section.organizationId === organizationId &&
          (campusId ? section.campusId === campusId : false)
      ),
    [campusId, classSectionOptions, organizationId]
  )
  const classBoard = isClassBoardKind(boardKind)
  const permissionSummary = `Students: read${
    allowStudentPosts ? " + post" : " only"
  } · Parents: read${allowParentPosts ? " + post" : " only"} · Comments: ${
    allowComments ? "on" : "off"
  }`

  function handleOrganizationChange(value: string) {
    setOrganizationId(value)
    setCampusId("")
    setClassSectionId("")
  }

  function handleCampusChange(value: string) {
    setCampusId(value)
    setClassSectionId("")
  }

  return (
    <form action={saveBoard} className="space-y-4">
      <input name="id" type="hidden" value={board?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Organization</span>
          <select
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="organizationId"
            value={organizationId}
            onChange={(event) => handleOrganizationChange(event.target.value)}
            required
          >
            {organizationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Campus</span>
          <select
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="campusId"
            value={campusId}
            onChange={(event) => handleCampusChange(event.target.value)}
          >
            <option value="">None / Organization scope</option>
            {filteredCampuses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Class section</span>
          <select
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-60"
            name="classSectionId"
            value={classSectionId}
            onChange={(event) => setClassSectionId(event.target.value)}
            disabled={!campusId}
          >
            <option value="">
              {campusId ? "None" : "Select a campus first"}
            </option>
            {filteredClassSections.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Class boards require a campus and class section.
          </span>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Board type</span>
          <select
            className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            name="boardKind"
            value={boardKind}
            onChange={(event) => {
              const value = event.target.value as BoardKind
              setBoardKind(value)
              if (value === "SCHOOL_ANNOUNCEMENTS") {
                setClassSectionId("")
              }
            }}
            required
          >
            {BOARD_KIND_OPTIONS.map((kind) => (
              <option key={kind} value={kind}>
                {boardKindLabel(kind)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {boardKindHelp(boardKind)}
          </span>
          {classBoard && !classSectionId ? (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Class boards require a class section.
            </span>
          ) : null}
          {boardKind === "SCHOOL_ANNOUNCEMENTS" && classSectionId ? (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              School announcements should not be attached to a class section.
            </span>
          ) : null}
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Title</span>
          <Input
            name="name"
            defaultValue={board?.name ?? ""}
            maxLength={200}
            placeholder="Example: School Announcements"
            required
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
            name="description"
            defaultValue={board?.description ?? ""}
            placeholder="Describe how this board should be used."
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <CheckboxCard
          checked={allowStudentPosts}
          help="If enabled, students who can access this board may create posts. Recommended: off for announcements, on for Q&A."
          label="Allow student posts"
          name="allowStudentPosts"
          onChange={setAllowStudentPosts}
        />
        <CheckboxCard
          checked={allowParentPosts}
          help="If enabled, parents who can access this board may create posts. Recommended: off unless this board is intended for parent questions or communication."
          label="Allow parent posts"
          name="allowParentPosts"
          onChange={setAllowParentPosts}
        />
        <CheckboxCard
          checked={allowComments}
          help="If enabled, users with access can reply under posts. Turn off for one-way announcements."
          label="Allow comments"
          name="allowComments"
          onChange={setAllowComments}
        />
        <CheckboxCard
          checked={board?.isActive ?? true}
          help="If disabled, the board is hidden from normal users but can still be managed by admins."
          label="Active"
          name="isActive"
        />
      </div>

      <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        {permissionSummary}
      </p>
      <div>
        <Button size="sm" type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function CheckboxCard({
  checked,
  help,
  label,
  name,
  onChange,
}: {
  checked: boolean
  help: string
  label: string
  name: string
  onChange?: (checked: boolean) => void
}) {
  const [isChecked, setIsChecked] = useState(checked)

  return (
    <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
      <input
        className="mt-1"
        name={name}
        type="checkbox"
        checked={isChecked}
        onChange={(event) => {
          setIsChecked(event.target.checked)
          onChange?.(event.target.checked)
        }}
      />
      <span className="space-y-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
    </label>
  )
}
