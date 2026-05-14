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

## Local Infrastructure

Start PostgreSQL, Redis, and MinIO for local development:

```bash
docker compose up -d
docker ps
```

Copy `.env.example` to `.env.local` and replace placeholder values before running the app. The default local services are:

- PostgreSQL: `127.0.0.1:5432`, database `lms_db`, user `lms`
- Redis: `127.0.0.1:6379`
- MinIO API: `http://127.0.0.1:9000`
- MinIO console: `http://127.0.0.1:9001`
- MinIO bucket name: `lms-files`

Security warning: PostgreSQL, Redis, and MinIO are local infrastructure services and must not be exposed publicly. The Compose ports are bound to `127.0.0.1` only. When remote access is needed later, expose only the Next.js app through Cloudflare Tunnel.

## Demo Seed Data

After the database is migrated, load local-only demo data:

```bash
npx prisma db seed
```

The seed creates demo users for local development only. Do not reuse these credentials outside your PC.

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | `super.admin@demo.local` | `DemoPass123!` |
| SCHOOL_ADMIN | `school.admin@demo.local` | `DemoPass123!` |
| INSTRUCTOR | `instructor@demo.local` | `DemoPass123!` |
| STUDENT | `student@demo.local` | `DemoPass123!` |
| PARENT | `parent@demo.local` | `DemoPass123!` |

## Project Structure

- `src/app` - App Router pages, layouts, and route handlers.
- `src/components/ui` - shadcn/ui primitives.
- `src/modules` - LMS domain modules such as academics, attendance, assignments, grades, messaging, and files.
- `src/lib` - shared application utilities.
- `src/server` - server-side integrations and application services.
- `src/types` - shared TypeScript types.
- `docs` - self-hosting and product documentation.
- `scripts` - local automation and maintenance scripts.
