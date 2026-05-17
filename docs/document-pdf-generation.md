# Document PDF Generation

The LMS currently generates report card and transcript PDFs directly from
server-side routes:

- `/api/documents/report-card`
- `/api/documents/transcript`

PDF generation uses Puppeteer to render safe server-generated HTML. This keeps
report card and transcript downloads working even while MinIO file download and
long-term document storage are still being stabilized.

Current controls:

- Admin and academic staff access is scoped before PDF generation.
- Students can download only their own documents.
- Parents can download only linked students' documents.
- Student and parent downloads include only published or finalized grades.
- Administrative previews can include draft grades within scope.
- Filenames are sanitized and do not include raw internal IDs.
- PDFs do not include password hashes, storage keys, secrets, or raw file URLs.

TODO:

- Store generated PDF binaries in MinIO through `FileAsset`.
- Link stored PDFs from `GeneratedDocument.fileAssetId`.
- Add embedded Korean font support if local rendering lacks suitable fonts.
- Add formal document issue/revoke workflows for report cards and transcripts.
