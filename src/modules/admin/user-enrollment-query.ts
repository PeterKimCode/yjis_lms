"use server"

import { z } from "zod"
import { getUserEnrollmentData } from "./user-enrollment-data"

const schema = z.object({
  userId: z.string().min(1).max(128),
  page: z.number().int().positive(),
  q: z.string().max(200),
  tab: z.enum(["All", "Enrolled", "Not enrolled", "Other status"]),
  sectionId: z.string().max(128),
})

export async function loadUserEnrollmentPage(input: z.input<typeof schema>) {
  const { userId, ...query } = schema.parse(input)
  return getUserEnrollmentData(userId, query)
}
