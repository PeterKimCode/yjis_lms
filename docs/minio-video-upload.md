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
4. Upload MP4 files under `videos/`, for example `videos/demo-intro.mp4`.
5. Prefer app-managed file upload once the LMS file module is available.
6. Binary files live in MinIO. PostgreSQL stores file metadata only in `FileAsset`.
7. When using a MinIO-backed lesson video, the lesson should reference the uploaded video through `videoFileId` / `FileAsset.id`.

## Security Notes

- Do not expose MinIO publicly.
- Do not use raw MinIO URLs for students in production.
- Serve files through Next.js API routes with permission checks.
- Use presigned URLs only after checking the current user can access the class section and lesson.

## YouTube Note

YouTube lessons can be embedded by selecting the YouTube provider and entering a supported YouTube URL. Accurate YouTube progress tracking requires YouTube IFrame Player API.
