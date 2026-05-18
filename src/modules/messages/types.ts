import { ConversationType } from "@prisma/client"

export const MESSAGE_BODY_MAX_LENGTH = 5000

export const conversationTypeLabels: Record<ConversationType, string> = {
  DIRECT: "Direct",
  GROUP: "Group",
  HOMEROOM: "Homeroom",
  CLASS_SECTION: "Class group",
  SUPPORT: "Support",
}

export type MessageActionState = {
  ok: boolean
  message: string
}

export const initialMessageActionState: MessageActionState = {
  ok: false,
  message: "",
}
