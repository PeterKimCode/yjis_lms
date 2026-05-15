# MinIO Video Upload Workflow

Local MinIO is the development object store for LMS video files.

## Local Access

- Console URL: http://localhost:9001
- Username: `minio_admin`
- Password: `minio_password`
- Bucket: `lms-files`
- Recommended object path: `videos/`

## Workflow

1. Start local infrastructure with `docker compose up -d`.
2. Open the MinIO console at http://localhost:9001.
3. Create the `lms-files` bucket if it does not already exist.
4. Prefer the LMS lesson video upload form instead of uploading directly in the MinIO console.
5. The LMS upload form stores the binary file in MinIO and creates the matching `FileAsset` row in PostgreSQL.
6. Binary files live in MinIO. PostgreSQL stores file metadata only in `FileAsset`.
7. When using a MinIO-backed lesson video, select the uploaded video from the lesson form dropdown. The lesson references the uploaded video through `videoFileId` / `FileAsset.id`.

## MinIO Console Uploads

Uploading a file directly in the MinIO Console stores only the binary object. It does not automatically create `FileAsset` database metadata, so the video will not appear in the LMS lesson dropdown.

If a file was uploaded manually in the MinIO Console, an admin would need to create or sync the `FileAsset` metadata row separately. This should not be the normal workflow.

## Security Notes

- Do not expose MinIO publicly.
- Do not use raw MinIO URLs for students in production.
- Serve files through Next.js API routes with permission checks.
- Use presigned URLs only after checking the current user can access the class section and lesson.

## YouTube Note

YouTube lessons can be embedded by selecting the YouTube provider and entering a supported YouTube URL. Accurate YouTube progress tracking requires YouTube IFrame Player API.
