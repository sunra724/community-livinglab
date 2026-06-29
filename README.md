# Community Living Lab Dashboard

2026 커뮤니티 리빙랩 프로젝트 운영 대시보드입니다.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000/dashboard`.

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
```

`SUPABASE_SERVICE_ROLE_KEY` is supported for server-side admin reads, but do not add it to a public Vercel deployment until login and role-based routing are enabled. Without Supabase variables, the dashboard renders project-plan sample data.

## Database

Supabase migration and setup scripts are in `files/`.
