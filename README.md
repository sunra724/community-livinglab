# Community Living Lab Dashboard

2026 커뮤니티 리빙랩 프로젝트 운영 대시보드입니다.

## Local Development

```bash
npm install
npm run dev
```

Open:

- `http://127.0.0.1:3000/dashboard` for the status dashboard
- `http://127.0.0.1:3000/admin` for the operations action center

## Vercel

Import this repository into Vercel:

```text
sunra724/community-livinglab
```

Recommended production domain:

```text
community-livinglab.soilabcoop.kr
```

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_ACCESS_CODE=
```

`SUPABASE_SERVICE_ROLE_KEY` enables `/admin` write actions. In production, also set `ADMIN_ACCESS_CODE`; without it, write actions stay locked. Without Supabase variables, the dashboard renders project-plan sample data.

## Database

Supabase migration and setup scripts are in `files/`.

Run these in Supabase SQL Editor:

1. `files/001_initial_schema.sql`
2. `files/002_company_isolation.sql`
3. `files/004_demo_seed.sql`

After that, `/dashboard` reads the seeded Supabase data instead of the built-in sample fallback, and `/admin?key=YOUR_ADMIN_ACCESS_CODE` can update operational data.
