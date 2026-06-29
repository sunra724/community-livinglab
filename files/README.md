# AI Living Lab Platform · Supabase 마이그레이션 실행 가이드

소이랩 협동조합 · 2026-06-29

## 0. 권한 모델 한눈에

```
슈퍼관리자 (2명) — 이메일 식별
  soilabcoop@gmail.com · sunra724@gmail.com
  → 모든 프로젝트, 모든 데이터, 시스템 전체 접근

소이랩 운영자 (3명) — user_project_roles.role = 'admin'/'manager'
  강아름 · 장종욱 · 박기범
  → 담당 프로젝트 전체

기업 운영자 (4개사) — company_members 매핑
  ⚠️ 각 회사 데이터 완전 격리 (서로 못 봄)
  → 본인 회사 데이터 read/write
  → 본인 회사로 온 학생 제안 검토·피드백
  → 매칭된 청년 정보만 열람

청년 참여자 (8명) — participants.user_id 연결
  → 본인 제안 작성·수정 (draft·needs_revision 상태에서만)
  → 매칭된 회사 정보 열람
  → 다른 청년 제안 비공개
```

---

## 1. 실행 방법

### 방법 A — Supabase Dashboard 순차 실행 (권장)

1. Supabase 프로젝트 생성 (이름: `soilab-livinglab`, 리전: **Northeast Asia (Seoul)**)
2. SQL Editor → New query
3. **001_initial_schema.sql** 전체 붙여넣기 → Run
4. **002_company_isolation.sql** 전체 붙여넣기 → Run
5. 마지막 `NOTICE`에 `Migration 002 적용 완료` 확인
6. **003_user_setup.sql** 은 운영 중 필요한 시점에 섹션별로 사용

### 방법 B — Supabase CLI (Git 관리)

```bash
supabase init
mkdir -p supabase/migrations
cp 001_initial_schema.sql      supabase/migrations/20260629000000_initial_schema.sql
cp 002_company_isolation.sql   supabase/migrations/20260629000001_company_isolation.sql
# 003 은 마이그레이션이 아닌 운영 스크립트 → migrations 폴더 밖에 보관

supabase link --project-ref <project-ref>
supabase db push
```

---

## 2. 적용 확인 쿼리

SQL Editor에서 아래를 실행해 정상 적용 확인:

```sql
-- 1) 테이블 개수
-- 001만 적용: 19개 / 002까지 적용: 22개
select count(*) as table_count
  from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE';

-- 2) KNU 2026 프로젝트 시드 확인
select id, slug, name, target_companies, target_youths, target_citizens, target_satisfaction
  from projects where slug = 'knu-2026';

-- 3) 워크숍 4회차 시드 확인
select session_no, title, scheduled_at, location
  from events
 where phase = 'problem_discovery'
 order by session_no;

-- 4) 성과품 7종 슬롯 확인
select type, title, status
  from deliverables
 where project_id = (select id from projects where slug = 'knu-2026')
 order by type;

-- 5) KPI 뷰 (대시보드 핵심 쿼리)
select * from project_kpis where slug = 'knu-2026';
```

기대 결과: 002까지 적용 후 테이블 22개, 워크숍 4건, 성과품 슬롯 7건, KPI 뷰 1행(목표는 표시, 현재 수치는 모두 0).

---

## 3. 사용자 등록 순서 (003_user_setup.sql 사용)

`003_user_setup.sql` 의 섹션 A → B → C → D 순서로 진행합니다.

### A. 슈퍼관리자 2명 (최우선)

Supabase Dashboard → Authentication → Users → Add user
- `soilabcoop@gmail.com` 가입
- `sunra724@gmail.com` 가입

가입 즉시 `auto_grant_super_admin()` 트리거가 KNU 2026 프로젝트에 admin 권한을 자동 부여합니다.

### B. 소이랩 운영진 3명

강아름·장종욱·박기범을 Auth에 가입시킨 뒤, 003의 섹션 B 쿼리에서 이메일만 실제 값으로 교체해 실행.

### C. 기업 4개사 운영자 (PT 심사 후 7/20~24)

4개사 선정 후 다음 흐름:
1. `participants` 에 회사 정보 등록 (`type = 'company'`)
2. 회사 대표/실무자 이메일로 Supabase Auth 초대
3. 가입 완료 후 `company_members` 에 매핑 → 자동으로 자기 회사 데이터만 접근

기업 운영자는 다른 3개 회사의 데이터를 **완전히 볼 수 없습니다** (RLS 정책으로 차단).

### D. 청년 8명

청년을 Auth 가입 → 003의 섹션 D 쿼리에서 이메일을 교체해 `participants` 등록 시 `user_id` 자동 연결 → `matchings` 로 기업당 2명 배정.

---

## 4. Next.js 연동 (TypeScript 타입 자동 생성)

```bash
# Supabase CLI 설치 (한 번만)
npm install -D supabase

# DB 스키마 → TypeScript 타입 자동 생성
npx supabase gen types typescript \
  --project-id <your-project-ref> \
  --schema public \
  > types/database.ts
```

생성된 `types/database.ts`를 Supabase 클라이언트에 적용:

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

---

## 5. 대시보드 KPI 조회 예시

```ts
// app/dashboard/page.tsx (서버 컴포넌트)
const { data: kpi } = await supabase
  .from('project_kpis')
  .select('*')
  .eq('slug', 'knu-2026')
  .single()

// kpi.current_companies / kpi.target_companies → 4/4
// kpi.current_citizens / kpi.target_citizens → X/150
// kpi.avg_satisfaction → null 또는 평균 (목표 4.5)
// kpi.deliverables_done / kpi.deliverables_total → 성과품 진척률
```

---

## 6. 익명 신청·피드백 경로 검증

모집과 사용자 피드백은 **로그인 없이** 제출 가능해야 합니다. RLS 정책이 이를 허용하는지 확인:

```sql
-- 익명 신청 테스트 (anon 키로 호출되는 INSERT)
insert into applications (project_id, type, applicant_name, contact_email, proposal)
select id, 'company', '테스트 기업', 'test@example.com', '{"problem":"테스트"}'::jsonb
  from projects where slug = 'knu-2026';

-- 익명으로는 SELECT 불가해야 함 (관리자 로그인 후에만 조회)
```

웹 폼에서는 Supabase `anon` 키만 사용해도 INSERT가 통과합니다.

---

## 7. 다음 단계 — 함께 만들 후보

이 SQL이 적용되면 바로 이어서 만들 수 있는 것들:

1. **청년용 제안 작성 페이지** — `student_proposals` 와 `proposal_comments` 를 활용한 청년 워크스페이스 (드래프트 저장, 제출, 수정 요청 응답)
2. **기업 운영자용 제안 검토 페이지** — 자기 회사로 온 제안 목록 (`company_proposal_summary` 뷰) + 검토·피드백·수용/거절 UI
3. **`/dashboard` 종합 페이지** — `project_kpis` 뷰 기반 KPI 카드 + 학생 제안 진행 현황 + 다가오는 워크숍
4. **AI 에이전트 라우트** — `app/api/ai/persona-synthesizer/route.ts` 등 4개 API + 프롬프트 명세
5. **HWPX 성과품 어댑터** — 기존 `hwpx-autofill` 스킬을 `deliverables` 테이블과 연결

원하시는 것부터 이어서 작업하겠습니다.

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `permission denied for schema auth` | RLS 헬퍼 함수가 `auth.users` 참조 | SQL Editor는 service_role로 실행되므로 정상. 클라이언트 호출 시 발생하면 헬퍼 함수에 `security definer` 누락 확인 |
| 신청 폼이 INSERT 실패 | RLS 정책 미적용 또는 anon 키 미사용 | `applications_anon_insert` 정책 존재 확인, 클라이언트가 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용 중인지 확인 |
| `project_kpis` 뷰가 빈 결과 | RLS가 view에 적용됨 | 운영진 로그인 후 조회. 또는 서버 컴포넌트에서 service_role 키 사용 |
| 트리거 중복 에러 | 재실행 시 트리거 충돌 | SQL이 멱등 처리됨 (drop trigger if exists). 그래도 실패하면 해당 트리거만 수동 drop |

---

## 운영 메모

- **백업:** Supabase Dashboard → Database → Backups에서 PITR (Point-in-Time Recovery) 활성화 권장
- **Slack 알림 연동:** GAS에서 `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`을 Script Properties에 저장 (기존 패턴 동일)
- **MCP 연결:** Notion API, Google Sheets API는 별도 환경변수로 관리 (`.env.local`)
- **도메인:** Gabia에서 `livinglab.soilabcoop.kr` CNAME → Vercel 추가 후 SSL 발급 확인
