-- =====================================================================
-- AI Living Lab Platform · Initial Schema
-- 소이랩 협동조합 (Soilab Cooperative) · 2026-06-29
--
-- 첫 테넌트: 2026 커뮤니티 리빙랩 프로젝트 (경북대학교 지역사회공헌센터)
--
-- 실행 방법:
--   1) Supabase Dashboard → SQL Editor → 새 쿼리 → 전체 붙여넣기 → Run
--   2) 또는 Supabase CLI: supabase db push 후
--      supabase/migrations/20260629000000_initial.sql 으로 저장
--
-- 멱등성: 모든 DDL이 IF NOT EXISTS / OR REPLACE 기반. 재실행 안전.
-- =====================================================================

-- =====================================================================
-- 1. EXTENSIONS
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";


-- =====================================================================
-- 2. ENUM TYPES
-- =====================================================================

do $$ begin
  create type project_status as enum ('planning','active','completed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type participant_type as enum ('company','youth','citizen','expert');
exception when duplicate_object then null; end $$;

do $$ begin
  create type participant_status as enum ('active','completed','dropped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('submitted','screening','shortlisted','selected','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_phase as enum ('recruit','problem_discovery','validation','sharing','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type validation_stage as enum ('preparation','execution','evaluation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_artifact_type as enum (
    'persona','stakeholder_map','insight','solution_idea',
    'mvp_spec','feedback_summary','draft_report','weekly_briefing'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type deliverable_type as enum (
    'kickoff_plan','problem_definition',
    'validation_plan','validation_report','final_report',
    'activity_photos','settlement'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type deliverable_status as enum ('draft','ai_generated','in_review','approved','submitted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin','manager','facilitator','viewer');
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 3. CORE: projects · profiles · user_project_roles
-- =====================================================================

-- 3.1 projects (멀티테넌트 루트)
create table if not exists projects (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  name                text not null,
  client_org          text not null,
  description         text,
  period_start        date not null,
  period_end          date not null,
  budget_krw          bigint default 0,
  status              project_status default 'planning',
  config              jsonb default '{}'::jsonb,
  -- KPI 목표 (과업지시서 명시 지표)
  target_companies    int default 0,
  target_youths       int default 0,
  target_citizens     int default 0,
  target_satisfaction numeric(3,2) default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
comment on table projects is '리빙랩 프로젝트 — 멀티테넌트 루트';
create index if not exists idx_projects_status on projects(status);

-- 3.2 profiles (Supabase auth.users 확장)
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  full_name       text,
  phone           text,
  organization    text,
  avatar_url      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
comment on table profiles is 'Supabase 인증 사용자 프로필 확장';

-- 3.3 user_project_roles (RLS 권한 매트릭스)
create table if not exists user_project_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  role        user_role not null default 'viewer',
  created_at  timestamptz default now(),
  unique(user_id, project_id)
);
create index if not exists idx_upr_user on user_project_roles(user_id);
create index if not exists idx_upr_project on user_project_roles(project_id);


-- =====================================================================
-- 4. RECRUITMENT: applications · evaluations · participants · matchings
-- =====================================================================

-- 4.1 applications (모집 신청서 — 익명 INSERT 허용)
create table if not exists applications (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  type            participant_type not null,
  applicant_name  text not null,
  contact_email   text not null,
  contact_phone   text,
  organization    text,
  -- 기업: 제안 지역문제·솔루션 / 청년: 동기·역량·포트폴리오 등
  proposal        jsonb default '{}'::jsonb,
  attachments     jsonb default '[]'::jsonb,
  status          application_status default 'submitted',
  submitted_at    timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_applications_project on applications(project_id, type);
create index if not exists idx_applications_status  on applications(status);

-- 4.2 evaluations (PT 심사 · 서면평가)
create table if not exists evaluations (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  evaluator_id    uuid references profiles(id),
  evaluator_name  text,            -- 외부 심사위원 (Auth 계정 없는 경우)
  criteria        jsonb not null default '{}'::jsonb,
  total_score     numeric(5,2),
  comments        text,
  created_at      timestamptz default now()
);
create index if not exists idx_evaluations_app on evaluations(application_id);

-- 4.3 participants (선정 확정 참여자)
create table if not exists participants (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  application_id  uuid references applications(id) on delete set null,
  type            participant_type not null,
  name            text not null,
  email           text,
  phone           text,
  organization    text,
  profile_data    jsonb default '{}'::jsonb,
  status          participant_status default 'active',
  joined_at       date default current_date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_participants_project on participants(project_id, type);
create index if not exists idx_participants_status  on participants(status);

-- 4.4 matchings (기업-청년 매칭, 기업당 청년 2명)
create table if not exists matchings (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  company_id  uuid not null references participants(id) on delete cascade,
  youth_ids   uuid[] not null default '{}',
  notes       text,
  paired_at   timestamptz default now(),
  created_at  timestamptz default now()
);
create index if not exists idx_matchings_project on matchings(project_id);
create index if not exists idx_matchings_company on matchings(company_id);


-- =====================================================================
-- 5. OPERATION: events · attendees · problem_definitions · validation
-- =====================================================================

-- 5.1 events (워크숍, 실증 회의, 성과공유회 등 모든 이벤트)
create table if not exists events (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  phase             event_phase not null,
  title             text not null,
  session_no        int,            -- 워크숍 회차 등
  scheduled_at      timestamptz not null,
  duration_minutes  int default 120,
  location          text,
  agenda            jsonb default '[]'::jsonb,
  facilitators      uuid[] default '{}',
  artifacts         jsonb default '[]'::jsonb,  -- 사진·녹음·문서 URL
  notes             text,
  status            text default 'planned',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists idx_events_project_phase on events(project_id, phase);
create index if not exists idx_events_scheduled on events(scheduled_at);

-- 5.2 event_attendees (출석부)
create table if not exists event_attendees (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  attended        bool default false,
  notes           text,
  created_at      timestamptz default now(),
  unique(event_id, participant_id)
);

-- 5.3 problem_definitions (문제정의서·기능요구서 — 기업별)
create table if not exists problem_definitions (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references projects(id) on delete cascade,
  company_id                uuid not null references participants(id) on delete cascade,
  problem_statement         text,
  stakeholders              jsonb default '[]'::jsonb,
  personas                  jsonb default '[]'::jsonb,
  functional_requirements   jsonb default '[]'::jsonb,
  version                   int default 1,
  is_final                  bool default false,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);
create index if not exists idx_problem_def_company on problem_definitions(project_id, company_id);

-- 5.4 validation_records (실증 3단계 기록 — 기업별·주차별)
create table if not exists validation_records (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  company_id      uuid not null references participants(id) on delete cascade,
  stage           validation_stage not null,
  week_no         int,
  mvp_spec        jsonb default '{}'::jsonb,
  metrics_target  jsonb default '{}'::jsonb,
  metrics_actual  jsonb default '{}'::jsonb,
  weekly_notes    text,
  expert_advice   text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_validation_company_stage
  on validation_records(project_id, company_id, stage);


-- =====================================================================
-- 6. AI LAYER: ai_artifacts · ai_calls_log
-- =====================================================================

-- 6.1 ai_artifacts (AI 산출물 — 인간 검토 게이트 필수)
create table if not exists ai_artifacts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  company_id      uuid references participants(id) on delete set null,
  type            ai_artifact_type not null,
  source_data     jsonb default '{}'::jsonb,
  ai_output       jsonb not null default '{}'::jsonb,
  ai_model        text,
  prompt_version  text,
  -- 인간 검토 게이트
  human_reviewed  bool default false,
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  review_notes    text,
  approved        bool default false,
  created_at      timestamptz default now()
);
create index if not exists idx_ai_artifacts_type on ai_artifacts(project_id, type);
create index if not exists idx_ai_artifacts_review on ai_artifacts(human_reviewed, approved);
comment on column ai_artifacts.approved is
  '인간 검토 + 승인 완료 시에만 deliverables 로 승격 가능';

-- 6.2 ai_calls_log (Claude API 호출 로그 — 비용·성능 추적)
create table if not exists ai_calls_log (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references projects(id) on delete set null,
  agent_name          text not null,    -- persona_synthesizer 등
  model               text not null,    -- claude-sonnet-4-6 등
  prompt_tokens       int,
  completion_tokens   int,
  duration_ms         int,
  status              text,             -- success / error
  error_message       text,
  called_by           uuid references profiles(id),
  created_at          timestamptz default now()
);
create index if not exists idx_ai_log_project_time on ai_calls_log(project_id, created_at desc);


-- =====================================================================
-- 7. FEEDBACK: 150명 실증 참여자 피드백
-- =====================================================================

-- 7.1 feedback_forms (수집 폼 정의 — QR 배포용)
create table if not exists feedback_forms (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  company_id  uuid references participants(id),
  title       text not null,
  schema      jsonb not null default '{}'::jsonb,
  qr_url      text,
  is_active   bool default true,
  created_at  timestamptz default now()
);
create index if not exists idx_feedback_forms_active on feedback_forms(project_id, is_active);

-- 7.2 user_feedback (응답 — 익명 INSERT 허용)
create table if not exists user_feedback (
  id                          uuid primary key default gen_random_uuid(),
  project_id                  uuid not null references projects(id) on delete cascade,
  company_id                  uuid references participants(id) on delete set null,
  form_id                     uuid references feedback_forms(id) on delete set null,
  respondent_token            text,           -- 익명 식별자 (중복 방지)
  respondent_demographics     jsonb default '{}'::jsonb,
  quantitative                jsonb default '{}'::jsonb,  -- 만족도 점수 등
  qualitative                 text,
  ai_coded                    jsonb default '{}'::jsonb,  -- AI 테마·감정 코딩
  channel                     text,           -- qr / online / offline
  submitted_at                timestamptz default now()
);
create index if not exists idx_feedback_project on user_feedback(project_id, company_id);
create index if not exists idx_feedback_time on user_feedback(submitted_at);


-- =====================================================================
-- 8. DELIVERABLES: 성과품 7종 (과업지시서 명시)
-- =====================================================================

create table if not exists deliverables (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  company_id        uuid references participants(id) on delete set null,
  type              deliverable_type not null,
  title             text not null,
  version           int default 1,
  status            deliverable_status default 'draft',
  content           jsonb default '{}'::jsonb,
  file_url          text,
  file_format       text,                 -- pdf / hwpx / jpg / zip
  ai_generated      bool default false,
  ai_artifact_id    uuid references ai_artifacts(id),
  approved_by       uuid references profiles(id),
  approved_at       timestamptz,
  submitted_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists idx_deliverables_type on deliverables(project_id, type);
create index if not exists idx_deliverables_status on deliverables(status);


-- =====================================================================
-- 9. AUX: stakeholders · budget · notifications
-- =====================================================================

-- 9.1 stakeholders (26개 협의체, 전문가 풀, 중간지원조직)
create table if not exists stakeholders (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete set null,
  name          text not null,
  organization  text,
  role          text,
  contact       jsonb default '{}'::jsonb,
  notes         text,
  tags          text[] default '{}',
  created_at    timestamptz default now()
);
create index if not exists idx_stakeholders_project on stakeholders(project_id);
create index if not exists idx_stakeholders_tags on stakeholders using gin(tags);

-- 9.2 budget_items (예산 집행 — 40,000천원)
create table if not exists budget_items (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  category          text not null,        -- 인건비/활동비/운영비
  description       text,
  planned_amount    bigint default 0,
  executed_amount   bigint default 0,
  executed_at       date,
  payee             text,
  evidence_url      text,
  created_at        timestamptz default now()
);
create index if not exists idx_budget_project_cat on budget_items(project_id, category);

-- 9.3 notifications (Slack·SMS·알림톡·이메일 발송 로그)
create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references projects(id),
  channel         text not null,
  recipient       text,
  subject         text,
  body            text,
  status          text default 'sent',
  error_message   text,
  sent_at         timestamptz default now()
);
create index if not exists idx_notifications_project_time on notifications(project_id, sent_at desc);


-- =====================================================================
-- 10. FUNCTIONS · TRIGGERS
-- =====================================================================

-- 10.1 updated_at 자동 갱신
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 트리거 일괄 적용
do $$
declare
  t text;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_name = c.table_name and tb.table_schema = c.table_schema
     where c.column_name = 'updated_at'
       and c.table_schema = 'public'
       and tb.table_type = 'BASE TABLE'
  loop
    execute format('drop trigger if exists trg_set_updated_at on %I', t);
    execute format(
      'create trigger trg_set_updated_at before update on %I
         for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- 10.2 신규 인증 사용자 → profiles 자동 생성
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 10.3 RLS 헬퍼: 프로젝트 접근 권한 확인
create or replace function has_project_access(p_project_id uuid)
returns bool as $$
  select exists (
    select 1 from public.user_project_roles
     where project_id = p_project_id
       and user_id = auth.uid()
  );
$$ language sql security definer stable set search_path = public;

create or replace function is_project_manager(p_project_id uuid)
returns bool as $$
  select exists (
    select 1 from public.user_project_roles
     where project_id = p_project_id
       and user_id = auth.uid()
       and role in ('admin','manager')
  );
$$ language sql security definer stable set search_path = public;


-- =====================================================================
-- 11. KPI VIEW (대시보드 직접 조회용)
-- =====================================================================

create or replace view project_kpis
with (security_invoker = true) as
select
  p.id                                                       as project_id,
  p.slug,
  p.name,
  p.status,
  p.period_start,
  p.period_end,
  p.target_companies,
  p.target_youths,
  p.target_citizens,
  p.target_satisfaction,
  -- 현재 참여 현황
  (select count(*) from participants
     where project_id = p.id and type = 'company' and status = 'active') as current_companies,
  (select count(*) from participants
     where project_id = p.id and type = 'youth'   and status = 'active') as current_youths,
  -- 누적 시민 피드백 응답자 수 (150명 목표)
  (select count(distinct coalesce(respondent_token, id::text))
     from user_feedback where project_id = p.id)                          as current_citizens,
  -- 평균 만족도 (quantitative->>'overall_satisfaction' 기준)
  (select round(avg((quantitative->>'overall_satisfaction')::numeric), 2)
     from user_feedback
     where project_id = p.id
       and quantitative ? 'overall_satisfaction')                         as avg_satisfaction,
  -- 성과품 진척률
  (select count(*) from deliverables
     where project_id = p.id and status in ('approved','submitted'))      as deliverables_done,
  (select count(*) from deliverables where project_id = p.id)             as deliverables_total,
  -- 예산
  p.budget_krw                                                            as budget_planned,
  (select coalesce(sum(executed_amount),0) from budget_items
     where project_id = p.id)                                             as budget_executed
from projects p;

comment on view project_kpis is '프로젝트별 실시간 KPI — 대시보드 단일 조회용';


-- =====================================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================================

-- 전 테이블 RLS 활성화
alter table projects              enable row level security;
alter table profiles              enable row level security;
alter table user_project_roles    enable row level security;
alter table applications          enable row level security;
alter table evaluations           enable row level security;
alter table participants          enable row level security;
alter table matchings             enable row level security;
alter table events                enable row level security;
alter table event_attendees       enable row level security;
alter table problem_definitions   enable row level security;
alter table validation_records    enable row level security;
alter table ai_artifacts          enable row level security;
alter table ai_calls_log          enable row level security;
alter table feedback_forms        enable row level security;
alter table user_feedback         enable row level security;
alter table deliverables          enable row level security;
alter table stakeholders          enable row level security;
alter table budget_items          enable row level security;
alter table notifications         enable row level security;

-- 정책 재생성 헬퍼 (멱등성)
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- 12.1 profiles
create policy profiles_self_select on profiles
  for select using (id = auth.uid());
create policy profiles_self_update on profiles
  for update using (id = auth.uid());

-- 12.2 projects
create policy projects_member_select on projects
  for select using (has_project_access(id));
create policy projects_manager_all on projects
  for all using (is_project_manager(id))
  with check (is_project_manager(id));

-- 12.3 user_project_roles
create policy upr_self_select on user_project_roles
  for select using (user_id = auth.uid() or is_project_manager(project_id));
create policy upr_manager_all on user_project_roles
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.4 applications — 익명 INSERT 허용 + 관리자 조회
create policy applications_anon_insert on applications
  for insert to anon, authenticated
  with check (status = 'submitted'::application_status);  -- 누구나 신규 신청 가능
create policy applications_manager_select on applications
  for select using (is_project_manager(project_id));
create policy applications_manager_update on applications
  for update using (is_project_manager(project_id));
create policy applications_manager_delete on applications
  for delete using (is_project_manager(project_id));

-- 12.5 evaluations — 매니저 전용
create policy evaluations_manager_rw on evaluations
  for all using (
    exists(
      select 1 from applications a
       where a.id = application_id
         and is_project_manager(a.project_id)
    )
  )
  with check (
    exists(
      select 1 from applications a
       where a.id = application_id
         and is_project_manager(a.project_id)
    )
  );

-- 12.6 participants
create policy participants_member_select on participants
  for select using (has_project_access(project_id));
create policy participants_manager_all on participants
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.7 matchings
create policy matchings_member_select on matchings
  for select using (has_project_access(project_id));
create policy matchings_manager_all on matchings
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.8 events
create policy events_member_select on events
  for select using (has_project_access(project_id));
create policy events_manager_all on events
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.9 event_attendees
create policy attendees_member_select on event_attendees
  for select using (
    exists(select 1 from events e
             where e.id = event_id
               and has_project_access(e.project_id))
  );
create policy attendees_manager_write on event_attendees
  for all using (
    exists(select 1 from events e
             where e.id = event_id
               and is_project_manager(e.project_id))
  )
  with check (
    exists(select 1 from events e
             where e.id = event_id
               and is_project_manager(e.project_id))
  );

-- 12.10 problem_definitions
create policy problem_def_member_select on problem_definitions
  for select using (has_project_access(project_id));
create policy problem_def_manager_all on problem_definitions
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.11 validation_records
create policy validation_member_select on validation_records
  for select using (has_project_access(project_id));
create policy validation_manager_all on validation_records
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.12 ai_artifacts
create policy ai_artifacts_member_select on ai_artifacts
  for select using (has_project_access(project_id));
create policy ai_artifacts_manager_all on ai_artifacts
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.13 ai_calls_log — 매니저만 조회 (비용 관리)
create policy ai_log_manager on ai_calls_log
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.14 feedback_forms
create policy feedback_forms_public_read on feedback_forms
  for select using (is_active = true);   -- QR 응답자가 폼 스키마 조회
create policy feedback_forms_manager_all on feedback_forms
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.15 user_feedback — 익명 INSERT 허용 + 권한자 조회
create policy user_feedback_anon_insert on user_feedback
  for insert with check (true);
create policy user_feedback_member_select on user_feedback
  for select using (has_project_access(project_id));
create policy user_feedback_manager_update on user_feedback
  for update using (is_project_manager(project_id));

-- 12.16 deliverables
create policy deliverables_member_select on deliverables
  for select using (has_project_access(project_id));
create policy deliverables_manager_all on deliverables
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.17 stakeholders
create policy stakeholders_member_select on stakeholders
  for select using (
    project_id is null or has_project_access(project_id)
  );
create policy stakeholders_manager_all on stakeholders
  for all using (
    project_id is null or is_project_manager(project_id)
  )
  with check (
    project_id is null or is_project_manager(project_id)
  );

-- 12.18 budget_items — 매니저 전용
create policy budget_manager_all on budget_items
  for all using (is_project_manager(project_id))
  with check (is_project_manager(project_id));

-- 12.19 notifications — 매니저 전용
create policy notifications_manager_all on notifications
  for all using (
    project_id is null or is_project_manager(project_id)
  )
  with check (
    project_id is null or is_project_manager(project_id)
  );


-- =====================================================================
-- 13. STORAGE BUCKETS
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('workshop-artifacts', 'workshop-artifacts', false),
  ('deliverables',       'deliverables',       false),
  ('feedback-uploads',   'feedback-uploads',   false),
  ('public-assets',      'public-assets',      true)
on conflict (id) do nothing;

-- 스토리지 정책: 인증 사용자만 업로드/조회 (public-assets 제외)
drop policy if exists "auth_can_read_private_buckets"  on storage.objects;
drop policy if exists "auth_can_write_private_buckets" on storage.objects;
drop policy if exists "anyone_reads_public_assets"     on storage.objects;
drop policy if exists "anon_writes_feedback_uploads"   on storage.objects;

create policy "auth_can_read_private_buckets" on storage.objects
  for select to authenticated
  using (bucket_id in ('workshop-artifacts','deliverables','feedback-uploads'));

create policy "auth_can_write_private_buckets" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('workshop-artifacts','deliverables','feedback-uploads'));

create policy "anyone_reads_public_assets" on storage.objects
  for select using (bucket_id = 'public-assets');

create policy "anon_writes_feedback_uploads" on storage.objects
  for insert with check (bucket_id = 'feedback-uploads');


-- =====================================================================
-- 14. SEED: KNU 2026 프로젝트 + 예산 항목
-- =====================================================================

insert into projects (
  slug, name, client_org, description,
  period_start, period_end, budget_krw, status,
  target_companies, target_youths, target_citizens, target_satisfaction,
  config
)
values (
  'knu-2026',
  '2026 커뮤니티 리빙랩 프로젝트',
  '경북대학교 지역사회공헌센터',
  '대학-주민 커뮤니티 실험실 운영 용역. 사회적경제기업 4개사와 경북대 재학생 8명을 매칭하여 지역문제를 발굴하고 6주 이상의 현장 실증을 통해 솔루션을 고도화한다.',
  '2026-06-29',
  '2026-12-31',
  40000000,
  'active',
  4, 8, 150, 4.50,
  jsonb_build_object(
    'workshop_sessions', 4,
    'validation_weeks_min', 6,
    'youth_stipend_per_session', 50000,
    'youth_sessions_total', 8,
    'certification_threshold', 'all_sessions',
    'completion_threshold', 0.80
  )
)
on conflict (slug) do nothing;

-- 예산 항목 초안
with seed(project_id, category, description, planned_amount) as (
  select id, '인건비', '청년 8명 × 5만원 × 8회', 3200000 from projects where slug = 'knu-2026'
  union all
  select id, '운영비', '워크숍 4회차 운영 (장소·다과·재료)', 4000000 from projects where slug = 'knu-2026'
  union all
  select id, '실증비', '기업 4개사 MVP 실증 (기업당 5,000천원)', 20000000 from projects where slug = 'knu-2026'
  union all
  select id, '전문가', '디자인씽킹 퍼실·전문가 자문', 5000000 from projects where slug = 'knu-2026'
  union all
  select id, '성과공유회', '12월 성과공유회 운영', 3000000 from projects where slug = 'knu-2026'
  union all
  select id, '제작비', '결과보고서·증빙·디자인', 2000000 from projects where slug = 'knu-2026'
  union all
  select id, '예비비', '예비·기타', 2800000 from projects where slug = 'knu-2026'
)
insert into budget_items (project_id, category, description, planned_amount)
select s.project_id, s.category, s.description, s.planned_amount
from seed s
where not exists (
  select 1 from budget_items b
   where b.project_id = s.project_id
     and b.category = s.category
     and b.description = s.description
);

-- 워크숍 4회차 일정 시드 (7/27 ~ 8/31)
with seed(session_no, title, scheduled_at, location, agenda) as (
  values
    (1, '오리엔테이션 및 팀빌딩',     '2026-07-28 14:00+09', '경북대학교',
       '["사업 소개","참여자 역할 정의","방법론 교육","팀별 문제영역 설정"]'::jsonb),
    (2, '문제정의 심화학습',          '2026-08-04 14:00+09', '경북대학교',
       '["현장조사 방법론","이해관계자 맵핑","페르소나 설정"]'::jsonb),
    (3, '현장조사 실행',               '2026-08-18 14:00+09', '현장',
       '["문제당사자 인터뷰","현장 관찰","데이터 수집","벤치마킹"]'::jsonb),
    (4, '문제정의서 및 기능요구서',     '2026-08-25 14:00+09', '경북대학교',
       '["핵심문제 도출","기능요구서 작성","리빙랩 실증계획 수립"]'::jsonb)
)
insert into events (project_id, phase, title, session_no, scheduled_at, location, agenda)
select
  p.id, 'problem_discovery'::event_phase,
  s.title, s.session_no, s.scheduled_at::timestamptz, s.location, s.agenda
from projects p, seed s
where p.slug = 'knu-2026'
  and not exists (
    select 1 from events e
     where e.project_id = p.id
       and e.phase = 'problem_discovery'::event_phase
       and e.session_no = s.session_no
  );

-- 성과품 7종 슬롯 미리 생성 (draft 상태)
with seed(type, title) as (values
  ('kickoff_plan',          '착수계 / 운영계획서'),
  ('problem_definition',    '문제정의서 및 기능요구서'),
  ('validation_plan',       '실증계획서'),
  ('validation_report',     '실증 결과보고서'),
  ('final_report',          '최종 결과보고서'),
  ('activity_photos',       '활동사진 및 증빙자료'),
  ('settlement',            '정산 관련 자료')
)
insert into deliverables (project_id, type, title, status)
select p.id, s.type::deliverable_type, s.title, 'draft'::deliverable_status
from projects p, seed s
where p.slug = 'knu-2026'
  and not exists (
    select 1 from deliverables d
     where d.project_id = p.id
       and d.company_id is null
       and d.type = s.type::deliverable_type
  );


-- =====================================================================
-- 15. POST-RUN 안내
-- =====================================================================

do $$
declare
  v_pid uuid;
begin
  select id into v_pid from projects where slug = 'knu-2026';
  raise notice '────────────────────────────────────────────────────';
  raise notice 'AI Living Lab Platform 스키마 적용 완료';
  raise notice 'KNU 2026 project_id: %', v_pid;
  raise notice '다음 단계:';
  raise notice '  1) Supabase Auth 에서 운영진(강아름·장종욱·박기범) 가입';
  raise notice '  2) user_project_roles 에 admin 권한 부여:';
  raise notice '     insert into user_project_roles(user_id, project_id, role)';
  raise notice '     values (''<user_id>'', ''%'', ''admin'');', v_pid;
  raise notice '  3) Next.js 앱에서 project_kpis 뷰 조회로 대시보드 구성';
  raise notice '────────────────────────────────────────────────────';
end $$;
