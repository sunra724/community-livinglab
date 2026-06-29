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
- `http://127.0.0.1:3000/login` for Supabase Auth login
- `http://127.0.0.1:3000/portal` for role-based workspaces

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

For login-based operation:

1. Create users in Supabase Authentication.
2. Run the relevant sections in `files/003_user_setup.sql`.
3. Use `/login`, then `/portal`.

Role routing:

- `soilabcoop@gmail.com`, `sunra724@gmail.com`, or `user_project_roles.role in ('admin','manager')`: operations portal and `/admin` write access
- `company_members`: company portal and own proposal review
- `participants.user_id` with `type='youth'`: youth portal and proposal submission
