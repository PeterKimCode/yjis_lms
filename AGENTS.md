<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## LMS releases

After verifying an LMS update, commit the intended changes, push to GitHub `main`,
and run the existing `deploy-lms` command on GMKtec. Back up the production
database before a release that includes migrations. Verify the affected production
paths after deployment. Follow any explicit release scope the user gives for the task.
