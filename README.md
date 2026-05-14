# Self-Hosted School LMS

A Next.js App Router LMS foundation for running a school learning platform on a personal PC. The project is intentionally local-first: services run on the machine you control, with the option to expose the app later through Cloudflare Tunnel.

## Local Self-Hosting Goal

The initial target is a private deployment backed by local PostgreSQL for application data, MinIO for S3-compatible file storage, and Redis for caching, queues, rate limiting, and session-adjacent workloads. No real secrets are committed; use environment variables for database URLs, object storage credentials, authentication secrets, and tunnel configuration.

## Tech Stack

- Next.js App Router with TypeScript
- Tailwind CSS and shadcn/ui
- Prisma and PostgreSQL
- NextAuth.js, Zod, bcryptjs, React Hook Form
- TanStack Table and TanStack Query
- MinIO via AWS SDK S3 clients and presigned URLs
- Redis via ioredis
- Recharts, lucide-react, and Puppeteer

## Development Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Project Structure

- `src/app` - App Router pages, layouts, and route handlers.
- `src/components/ui` - shadcn/ui primitives.
- `src/modules` - LMS domain modules such as academics, attendance, assignments, grades, messaging, and files.
- `src/lib` - shared application utilities.
- `src/server` - server-side integrations and application services.
- `src/types` - shared TypeScript types.
- `docs` - self-hosting and product documentation.
- `scripts` - local automation and maintenance scripts.
