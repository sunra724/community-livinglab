-- =====================================================================
-- AI Living Lab Platform · Migration 002
-- 권한 격리 + 학생 제안 시스템
-- 소이랩 협동조합 · 2026-06-29
--
-- 추가:
--   1) 슈퍼관리자 2명 (이메일 식별): soilabcoop@gmail.com, sunra724@gmail.com
--   2) 기업 운영자 (company_members 매핑) - 4개사 데이터 격리
--   3) 청년 참여자 (participants.user_id 연결)
--   4) student_proposals - 청년 → 기업 제안, 상태 머신 기반
--   5) proposal_comments - 양방향 대화 스레드
--
-- 전제: 001_initial_schema.sql 이 이미 적용된 환경
-- 멱등성: 모든 DDL이 재실행 안전
-- =====================================================================


-- =====================================================================
-- 1. ENUM 확장
-- =====================================================================

do $$ begin
  alter type user_role add value if not exists 'super_admin';
exception when others then null; end $$;

do $$ begin
  alter type user_role add value if not exists 'company_owner';
exception when others then null; end $$;

do $$ begin
  alter type user_role add value if not exists 'youth_member';
exception when others then null; end $$;

do $$ begin
  create type proposal_status as enum (
    'draft',          -- 청년 작성 중 (본인만 보임)
    'submitted',      -- 기업에 제출됨 (수정 불가)
    'under_review',   -- 기업 검토 중
    'needs_revision', -- 기업이 수정 요청 → 청년 재수정 가능
    'accepted',       -- 기업 수용
    'rejected'        -- 기업 거절 (사유 필수)
  );
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 2. 참여자 ↔ 인증 계정 연결
-- =====================================================================

alter table participants
  add column if not exists user_id uuid references profiles(id) on delete set null;

create index if not exists idx_participants_user on participants(user_id);

comment on column participants.user_id is
  '기업 대표 또는 청년의 Supabase Auth 계정 ID. 가입 후 수동 또는 link_participant_to_user() 함수로 연결';


-- =====================================================================
-- 3. company_members (기업 운영자 매핑 - RLS 격리 핵심)
-- =====================================================================

create table if not exists company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references participants(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  role          text default 'owner',   -- owner / staff / observer
  created_at    timestamptz default now(),
  unique(company_id, user_id)
);

create index if not exists idx_company_members_user on company_members(user_id);
create index if not exists idx_company_members_company on company_members(company_id);

comment on table company_members is
  '기업별 운영자 매핑. 한 기업에 여러 운영자 가능. RLS 격리의 핵심 키.';


-- =====================================================================
-- 4. student_proposals (청년 → 기업 제안)
-- =====================================================================

create table if not exists student_proposals (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  company_id          uuid not null references participants(id) on delete cascade,
  author_id           uuid not null references participants(id) on delete cascade,
  parent_proposal_id  uuid references student_proposals(id),  -- 수정본 추적

  title               text not null,
  content             text not null,
  category            text,            -- UX 개선 / 기능 추가 / 서비스 모델 등
  attachments         jsonb default '[]'::jsonb,

  status              proposal_status default 'draft',

  -- 기업 피드백
  company_feedback    text,
  company_decision    text,
  reviewed_by         uuid references profiles(id),
  reviewed_at         timestamptz,

  version             int default 1,
  submitted_at        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_proposals_company on student_proposals(project_id, company_id);
create index if not exists idx_proposals_author  on student_proposals(author_id);
create index if not exists idx_proposals_status  on student_proposals(status);

-- updated_at 트리거
drop trigger if exists trg_set_updated_at on student_proposals;
create trigger trg_set_updated_at before update on student_proposals
  for each row execute function set_updated_at();

-- 상태 전이 검증 트리거 (잘못된 전이 방지)
create or replace function validate_proposal_transition()
returns trigger as $$
begin
  -- 초기 INSERT는 draft 또는 submitted만 허용
  if tg_op = 'INSERT' then
    if new.status not in ('draft','submitted') then
      raise exception '신규 제안은 draft 또는 submitted 상태로만 생성 가능 (시도: %)', new.status;
    end if;
    if new.status = 'submitted' then
      new.submitted_at = coalesce(new.submitted_at, now());
    end if;
    return new;
  end if;

  -- 상태 미변경
  if old.status = new.status then
    return new;
  end if;

  -- 전이 규칙
  if old.status = 'draft' and new.status not in ('submitted') then
    raise exception 'draft 에서는 submitted 로만 전이 가능';
  elsif old.status = 'submitted' and new.status not in ('under_review','rejected','accepted','needs_revision') then
    raise exception 'submitted 에서는 under_review/accepted/needs_revision/rejected 로만 전이 가능';
  elsif old.status = 'under_review' and new.status not in ('accepted','rejected','needs_revision') then
    raise exception 'under_review 에서는 accepted/rejected/needs_revision 로만 전이 가능';
  elsif old.status = 'needs_revision' and new.status not in ('submitted') then
    raise exception 'needs_revision 에서는 submitted 로만 전이 가능';
  elsif old.status in ('accepted','rejected') then
    raise exception '확정 상태(% )는 더 이상 변경 불가', old.status;
  end if;

  -- 거절 시 사유 필수
  if new.status = 'rejected' and (new.company_feedback is null or length(trim(new.company_feedback)) < 5) then
    raise exception '거절(rejected) 시 company_feedback 필수 (5자 이상)';
  end if;

  -- submitted 전이 시 submitted_at 자동 기록
  if new.status = 'submitted' and old.status in ('draft','needs_revision') then
    new.submitted_at = now();
    new.version = old.version + case when old.status = 'needs_revision' then 1 else 0 end;
  end if;

  -- 기업 검토 상태 변경 시 reviewed_at·reviewed_by 자동 기록
  if new.status in ('under_review','accepted','rejected','needs_revision')
     and old.status not in ('under_review','accepted','rejected','needs_revision') then
    new.reviewed_at = now();
    new.reviewed_by = coalesce(new.reviewed_by, auth.uid());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_validate_proposal on student_proposals;
create trigger trg_validate_proposal
  before insert or update on student_proposals
  for each row execute function validate_proposal_transition();


-- =====================================================================
-- 5. proposal_comments (대화 스레드)
-- =====================================================================

create table if not exists proposal_comments (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references student_proposals(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  author_role   text,                    -- student / company / soilab
  content       text not null,
  created_at    timestamptz default now()
);

create index if not exists idx_proposal_comments_proposal on proposal_comments(proposal_id);


-- =====================================================================
-- 6. HELPER FUNCTIONS (RLS 핵심)
-- =====================================================================

-- 6.1 슈퍼관리자 식별 (이메일 기반 - DB 변조에 견고)
create or replace function is_super_admin()
returns bool as $$
  select coalesce((
    select lower(email) in ('soilabcoop@gmail.com','sunra724@gmail.com')
    from auth.users where id = auth.uid()
  ), false);
$$ language sql security definer stable set search_path = public;

-- 6.2 내가 운영자인 기업 ID 배열
create or replace function my_company_ids()
returns uuid[] as $$
  select coalesce(array_agg(company_id), '{}'::uuid[])
  from company_members
  where user_id = auth.uid();
$$ language sql security definer stable set search_path = public;

-- 6.3 특정 기업의 운영자인지
create or replace function is_company_member(p_company_id uuid)
returns bool as $$
  select p_company_id = any(my_company_ids());
$$ language sql security definer stable set search_path = public;

-- 6.4 내가 청년 participant 로 매칭된 회사들
create or replace function my_youth_company_ids(p_project_id uuid)
returns uuid[] as $$
  select coalesce(array_agg(distinct m.company_id), '{}'::uuid[])
  from matchings m
  where m.project_id = p_project_id
    and exists (
      select 1 from participants p
       where p.id = any(m.youth_ids)
         and p.user_id = auth.uid()
    );
$$ language sql security definer stable set search_path = public;

-- 6.5 어떤 청년 participant 가 내가 운영하는 회사에 매칭됐는지
create or replace function is_my_company_youth(p_youth_participant_id uuid)
returns bool as $$
  select exists (
    select 1 from matchings m
    where m.company_id = any(my_company_ids())
      and p_youth_participant_id = any(m.youth_ids)
  );
$$ language sql security definer stable set search_path = public;

-- 6.6 내 청년 participant ID
create or replace function my_youth_participant_id(p_project_id uuid)
returns uuid as $$
  select id from participants
   where project_id = p_project_id
     and user_id = auth.uid()
     and type = 'youth'
   limit 1;
$$ language sql security definer stable set search_path = public;

-- 6.7 has_project_access 업데이트 - 슈퍼관리자/참여자 통합
create or replace function has_project_access(p_project_id uuid)
returns bool as $$
  select
    is_super_admin()
    or exists (
      select 1 from user_project_roles
       where project_id = p_project_id and user_id = auth.uid()
    )
    or exists (
      select 1 from participants
       where project_id = p_project_id and user_id = auth.uid()
    );
$$ language sql security definer stable set search_path = public;

-- 6.8 is_project_manager 업데이트 - 슈퍼관리자는 무조건 통과
create or replace function is_project_manager(p_project_id uuid)
returns bool as $$
  select
    is_super_admin()
    or exists (
      select 1 from user_project_roles
       where project_id = p_project_id
         and user_id = auth.uid()
         and role in ('admin','manager')
    );
$$ language sql security definer stable set search_path = public;


-- =====================================================================
-- 7. RLS 정책 재설계 (기존 정책 drop 후 재구성)
-- =====================================================================

-- 7.0 001 정책 하드닝: 참여자 권한 확장 후에도 신청·심사·출석부는 운영진이 관리
drop policy if exists applications_anon_insert on applications;
drop policy if exists applications_member_select on applications;
drop policy if exists applications_manager_select on applications;

create policy applications_anon_insert on applications
  for insert to anon, authenticated
  with check (status = 'submitted'::application_status);

create policy applications_manager_select on applications
  for select using (is_project_manager(project_id));

drop policy if exists evaluations_member_rw on evaluations;
drop policy if exists evaluations_manager_rw on evaluations;

create policy evaluations_manager_rw on evaluations
  for all using (
    exists (
      select 1 from applications a
       where a.id = application_id
         and is_project_manager(a.project_id)
    )
  )
  with check (
    exists (
      select 1 from applications a
       where a.id = application_id
         and is_project_manager(a.project_id)
    )
  );

drop policy if exists attendees_member_rw on event_attendees;
drop policy if exists attendees_member_select on event_attendees;
drop policy if exists attendees_manager_write on event_attendees;

create policy attendees_member_select on event_attendees
  for select using (
    exists (
      select 1 from events e
       where e.id = event_id
         and has_project_access(e.project_id)
    )
  );

create policy attendees_manager_write on event_attendees
  for all using (
    exists (
      select 1 from events e
       where e.id = event_id
         and is_project_manager(e.project_id)
    )
  )
  with check (
    exists (
      select 1 from events e
       where e.id = event_id
         and is_project_manager(e.project_id)
    )
  );

-- 7.1 participants (가장 복잡 - 4개 시야 통합)
drop policy if exists participants_member_select on participants;
drop policy if exists participants_manager_all   on participants;

create policy participants_visibility on participants
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    -- 본인
    or user_id = auth.uid()
    -- 기업 운영자: 자기 회사 본체
    or id = any(my_company_ids())
    -- 기업 운영자: 자기 회사에 매칭된 청년들
    or (type = 'youth' and is_my_company_youth(id))
    -- 청년: 자기가 매칭된 회사
    or (type = 'company' and id = any(my_youth_company_ids(project_id)))
  );

create policy participants_manager_write on participants
  for all using (is_super_admin() or is_project_manager(project_id))
  with check (is_super_admin() or is_project_manager(project_id));

-- 7.2 company_members
alter table company_members enable row level security;

drop policy if exists company_members_self_read    on company_members;
drop policy if exists company_members_manager_write on company_members;

create policy company_members_visibility on company_members
  for select using (
    is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from participants p
       where p.id = company_id and is_project_manager(p.project_id)
    )
  );

create policy company_members_manager_write on company_members
  for all using (
    is_super_admin()
    or exists (
      select 1 from participants p
       where p.id = company_id and is_project_manager(p.project_id)
    )
  )
  with check (
    is_super_admin()
    or exists (
      select 1 from participants p
       where p.id = company_id and is_project_manager(p.project_id)
    )
  );

-- 7.3 student_proposals (핵심 격리)
alter table student_proposals enable row level security;

drop policy if exists proposals_visibility       on student_proposals;
drop policy if exists proposals_youth_insert     on student_proposals;
drop policy if exists proposals_youth_update     on student_proposals;
drop policy if exists proposals_youth_delete     on student_proposals;
drop policy if exists proposals_company_review   on student_proposals;
drop policy if exists proposals_manager_all      on student_proposals;

-- 읽기: 슈퍼/매니저 + 작성자 본인 + 받는 기업
create policy proposals_visibility on student_proposals
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    or author_id = my_youth_participant_id(project_id)
    or is_company_member(company_id)
  );

-- 청년: 본인 신규 제안 작성 (draft 또는 submitted 만)
create policy proposals_youth_insert on student_proposals
  for insert with check (
    author_id = my_youth_participant_id(project_id)
    and company_id = any(my_youth_company_ids(project_id))
    and status in ('draft','submitted')
  );

-- 청년: 본인 draft/needs_revision 상태일 때만 수정
create policy proposals_youth_update on student_proposals
  for update using (
    author_id = my_youth_participant_id(project_id)
    and status in ('draft','needs_revision')
  )
  with check (
    author_id = my_youth_participant_id(project_id)
    and company_id = any(my_youth_company_ids(project_id))
    -- 수정 후 상태는 draft/needs_revision 유지 또는 submitted 로만
    and status in ('draft','needs_revision','submitted')
  );

-- 청년: 본인 draft 만 삭제 가능
create policy proposals_youth_delete on student_proposals
  for delete using (
    status = 'draft'
    and author_id = my_youth_participant_id(project_id)
  );

-- 기업 운영자: 자기 회사로 온 제안의 검토·피드백
create policy proposals_company_review on student_proposals
  for update using (
    is_company_member(company_id)
    and status in ('submitted','under_review')
  )
  with check (
    is_company_member(company_id)
    -- 기업은 검토 관련 상태로만 전이 가능
    and status in ('under_review','accepted','rejected','needs_revision')
  );

-- 슈퍼/매니저: 모든 권한
create policy proposals_manager_all on student_proposals
  for all using (
    is_super_admin() or is_project_manager(project_id)
  )
  with check (
    is_super_admin() or is_project_manager(project_id)
  );

-- 7.4 proposal_comments
alter table proposal_comments enable row level security;

drop policy if exists proposal_comments_visibility on proposal_comments;
drop policy if exists proposal_comments_write      on proposal_comments;

create policy proposal_comments_visibility on proposal_comments
  for select using (
    exists (
      select 1 from student_proposals sp
       where sp.id = proposal_id
         and (
           is_super_admin()
           or is_project_manager(sp.project_id)
           or is_company_member(sp.company_id)
           or sp.author_id = my_youth_participant_id(sp.project_id)
         )
    )
  );

create policy proposal_comments_write on proposal_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from student_proposals sp
       where sp.id = proposal_id
         and (
           is_super_admin()
           or is_project_manager(sp.project_id)
           or is_company_member(sp.company_id)
           or sp.author_id = my_youth_participant_id(sp.project_id)
         )
    )
  );

-- 7.5 problem_definitions: 기업 운영자도 자기 회사 정의서 수정
drop policy if exists problem_def_member_select on problem_definitions;
drop policy if exists problem_def_manager_all   on problem_definitions;

create policy problem_def_visibility on problem_definitions
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    or is_company_member(company_id)
    or company_id = any(my_youth_company_ids(project_id))
  );

create policy problem_def_write on problem_definitions
  for all using (
    is_super_admin()
    or is_project_manager(project_id)
    or (is_company_member(company_id) and is_final = false)
  )
  with check (
    is_super_admin()
    or is_project_manager(project_id)
    or (is_company_member(company_id) and is_final = false)
  );

-- 7.6 validation_records: 기업 운영자 자기 회사 기록 수정
drop policy if exists validation_member_select on validation_records;
drop policy if exists validation_manager_all   on validation_records;

create policy validation_visibility on validation_records
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    or is_company_member(company_id)
    or company_id = any(my_youth_company_ids(project_id))
  );

create policy validation_write on validation_records
  for all using (
    is_super_admin()
    or is_project_manager(project_id)
    or is_company_member(company_id)
  )
  with check (
    is_super_admin()
    or is_project_manager(project_id)
    or is_company_member(company_id)
  );

-- 7.7 deliverables: 기업 운영자는 자기 회사 산출물만
drop policy if exists deliverables_member_select on deliverables;
drop policy if exists deliverables_manager_all   on deliverables;

create policy deliverables_visibility on deliverables
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    or (company_id is not null and is_company_member(company_id))
    or (company_id is null and has_project_access(project_id))
  );

create policy deliverables_write on deliverables
  for all using (
    is_super_admin()
    or is_project_manager(project_id)
    or (company_id is not null and is_company_member(company_id))
  )
  with check (
    is_super_admin()
    or is_project_manager(project_id)
    or (company_id is not null and is_company_member(company_id))
  );

-- 7.8 ai_artifacts: 기업은 자기 회사 + 승인된 것만
drop policy if exists ai_artifacts_member_select on ai_artifacts;
drop policy if exists ai_artifacts_manager_all   on ai_artifacts;

create policy ai_artifacts_visibility on ai_artifacts
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    or (
      company_id is not null
      and is_company_member(company_id)
      and (approved = true or human_reviewed = true)
    )
  );

create policy ai_artifacts_manager_write on ai_artifacts
  for all using (is_super_admin() or is_project_manager(project_id))
  with check (is_super_admin() or is_project_manager(project_id));

-- 7.9 user_feedback: 기업은 자기 회사로 들어온 응답만
drop policy if exists user_feedback_member_select  on user_feedback;
drop policy if exists user_feedback_manager_update on user_feedback;

create policy user_feedback_visibility on user_feedback
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    or (company_id is not null and is_company_member(company_id))
  );

create policy user_feedback_update on user_feedback
  for update using (
    is_super_admin()
    or is_project_manager(project_id)
    or (company_id is not null and is_company_member(company_id))
  )
  with check (
    is_super_admin()
    or is_project_manager(project_id)
    or (company_id is not null and is_company_member(company_id))
  );

-- 7.10 matchings: 본인 매칭만 보이게
drop policy if exists matchings_member_select on matchings;
drop policy if exists matchings_manager_all   on matchings;

create policy matchings_visibility on matchings
  for select using (
    is_super_admin()
    or is_project_manager(project_id)
    or is_company_member(company_id)
    or exists (
      select 1 from participants p
       where p.user_id = auth.uid() and p.id = any(youth_ids)
    )
  );

create policy matchings_manager_write on matchings
  for all using (is_super_admin() or is_project_manager(project_id))
  with check (is_super_admin() or is_project_manager(project_id));


-- =====================================================================
-- 8. 슈퍼관리자 자동 권한 부여
-- =====================================================================

-- 8.1 슈퍼관리자가 가입하면 모든 기존 프로젝트에 admin 권한 자동 부여
create or replace function auto_grant_super_admin()
returns trigger as $$
begin
  if lower(new.email) in ('soilabcoop@gmail.com','sunra724@gmail.com') then
    insert into user_project_roles (user_id, project_id, role)
    select new.id, p.id, 'admin'::user_role from projects p
    on conflict (user_id, project_id) do update set role = 'admin';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_auto_super_admin on profiles;
create trigger trg_auto_super_admin
  after insert on profiles
  for each row execute function auto_grant_super_admin();

-- 8.2 신규 프로젝트 생성 시 기존 슈퍼관리자에게 자동 권한 부여
create or replace function grant_super_admins_to_new_project()
returns trigger as $$
begin
  insert into user_project_roles (user_id, project_id, role)
  select p.id, new.id, 'admin'::user_role from profiles p
   where lower(p.email) in ('soilabcoop@gmail.com','sunra724@gmail.com')
  on conflict (user_id, project_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_grant_super_to_project on projects;
create trigger trg_grant_super_to_project
  after insert on projects
  for each row execute function grant_super_admins_to_new_project();

-- 8.3 이미 가입돼 있는 슈퍼관리자에게도 즉시 적용
insert into user_project_roles (user_id, project_id, role)
select pr.id, p.id, 'admin'::user_role
  from profiles pr cross join projects p
 where lower(pr.email) in ('soilabcoop@gmail.com','sunra724@gmail.com')
on conflict (user_id, project_id) do update set role = 'admin';


-- =====================================================================
-- 9. KPI 뷰 확장 (제안 진행 현황 추가)
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
  (select count(*) from participants
     where project_id = p.id and type = 'company' and status = 'active') as current_companies,
  (select count(*) from participants
     where project_id = p.id and type = 'youth'   and status = 'active') as current_youths,
  (select count(distinct coalesce(respondent_token, id::text))
     from user_feedback where project_id = p.id)                          as current_citizens,
  (select round(avg((quantitative->>'overall_satisfaction')::numeric), 2)
     from user_feedback
     where project_id = p.id
       and quantitative ? 'overall_satisfaction')                         as avg_satisfaction,
  (select count(*) from deliverables
     where project_id = p.id and status in ('approved','submitted'))      as deliverables_done,
  (select count(*) from deliverables where project_id = p.id)             as deliverables_total,
  -- 학생 제안 진행 현황 (신규)
  (select count(*) from student_proposals where project_id = p.id)        as proposals_total,
  (select count(*) from student_proposals
     where project_id = p.id and status = 'submitted')                    as proposals_pending,
  (select count(*) from student_proposals
     where project_id = p.id and status = 'accepted')                     as proposals_accepted,
  p.budget_krw                                                            as budget_planned,
  (select coalesce(sum(executed_amount),0) from budget_items
     where project_id = p.id)                                             as budget_executed
from projects p;


-- =====================================================================
-- 10. 기업별 제안 뷰 (기업 운영자 대시보드용)
-- =====================================================================

create or replace view company_proposal_summary
with (security_invoker = true) as
select
  c.id                                                       as company_id,
  c.project_id,
  c.name                                                     as company_name,
  count(sp.id)                                               as total_proposals,
  count(sp.id) filter (where sp.status = 'submitted')        as pending_review,
  count(sp.id) filter (where sp.status = 'under_review')     as in_review,
  count(sp.id) filter (where sp.status = 'needs_revision')   as needs_revision,
  count(sp.id) filter (where sp.status = 'accepted')         as accepted,
  count(sp.id) filter (where sp.status = 'rejected')         as rejected,
  max(sp.submitted_at)                                       as last_submitted_at
from participants c
left join student_proposals sp on sp.company_id = c.id
where c.type = 'company'
group by c.id, c.project_id, c.name;

comment on view company_proposal_summary is '기업별 학생 제안 진행 현황 - 기업 대시보드용';


-- =====================================================================
-- 11. POST-RUN 안내
-- =====================================================================

do $$
begin
  raise notice '────────────────────────────────────────────────────';
  raise notice 'Migration 002 적용 완료';
  raise notice '';
  raise notice '슈퍼관리자: soilabcoop@gmail.com, sunra724@gmail.com';
  raise notice '  → Auth 가입 시 자동으로 모든 프로젝트 admin 권한 부여';
  raise notice '';
  raise notice '추가된 테이블:';
  raise notice '  • company_members (기업 운영자 매핑)';
  raise notice '  • student_proposals (청년 → 기업 제안)';
  raise notice '  • proposal_comments (양방향 대화)';
  raise notice '';
  raise notice '다음 단계:';
  raise notice '  1) Auth에서 슈퍼관리자 2명, 소이랩 운영진 3명 가입';
  raise notice '  2) 기업 4개사 선정 후 participants 등록';
  raise notice '  3) 기업 대표 Auth 가입 → company_members 에 매핑';
  raise notice '  4) 청년 8명 가입 → participants.user_id 연결';
  raise notice '────────────────────────────────────────────────────';
end $$;
