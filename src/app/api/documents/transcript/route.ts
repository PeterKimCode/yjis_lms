import { downloadGradeDocument } from "@/modules/documents/download"

export function GET(request: Request) {
  return downloadGradeDocument(request, "TRANSCRIPT")
}
