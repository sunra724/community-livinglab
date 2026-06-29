-- =====================================================================
-- AI Living Lab Platform · User Setup Scripts
-- 실제 운영 시 자주 사용할 사용자 등록·매핑 명령 모음
--
-- 주의: 이 스크립트는 002 마이그레이션 적용 후 실행
-- 각 섹션은 독립적으로 실행 가능
-- =====================================================================


-- =====================================================================
-- A. 슈퍼관리자 2명 가입 (Supabase Dashboard에서 수행)
-- =====================================================================
--
-- 1) Supabase Dashboard → Authentication → Users → Add user
--    - Email: soilabcoop@gmail.com (또는 sunra724@gmail.com)
--    - Password: <임시 비밀번호 설정>
--    - ✅ Auto Confirm User 체크
--
-- 2) 가입 즉시 트리거(auto_grant_super_admin)가 자동으로
--    모든 기존 프로젝트에 admin 권한 부여
--
-- 3) 확인:
select pr.email, p.slug, upr.role
  from profiles pr
  join user_project_roles upr on upr.user_id = pr.id
  join projects p on p.id = upr.project_id
 where lower(pr.email) in ('soilabcoop@gmail.com','sunra724@gmail.com');


-- =====================================================================
-- B. 소이랩 운영진 3명 (강아름·장종욱·박기범) 등록
-- =====================================================================
--
-- 1) Supabase Auth에서 3명 가입 (방법은 A와 동일)
--    예: areum@soilabcoop.kr, jongwook@soilabcoop.kr, kibum@soilabcoop.kr
--
-- 2) 가입 후, KNU 2026 프로젝트에 admin 권한 부여:

insert into user_project_roles (user_id, project_id, role)
select u.id, p.id, 'admin'::user_role
  from auth.users u, projects p
 where u.email in (
   -- ⬇️ 실제 이메일로 교체
   'areum@soilabcoop.kr',
   'jongwook@soilabcoop.kr',
   'kibum@soilabcoop.kr'
 )
   and p.slug = 'knu-2026'
on conflict (user_id, project_id) do update set role = 'admin';

-- 확인
select pr.email, p.name, upr.role
  from profiles pr
  join user_project_roles upr on upr.user_id = pr.id
  join projects p on p.id = upr.project_id
 where p.slug = 'knu-2026';


-- =====================================================================
-- C. 기업 4개사 운영자 매핑 (PT 심사 후 선정 완료 시점)
-- =====================================================================
--
-- 시나리오: 7/16 PT 심사 후 4개사 선정 → 7/20~24 발표
--   1) participants에 4개사 등록 (type='company')
--   2) 각 기업 대표/실무자 이메일로 Supabase Auth 초대
--   3) 가입 후 company_members 에 매핑

-- C-1. 예시: 1번 기업 등록 (실제 정보로 교체)
insert into participants (
  project_id, type, name, email, phone, organization,
  profile_data, status
)
select
  p.id, 'company'::participant_type,
  '○○협동조합',                          -- 회사명
  'contact@company1.co.kr',              -- 대표 연락 이메일
  '053-XXX-XXXX',
  '○○협동조합',
  jsonb_build_object(
    'proposed_problem', '독거노인 식사 배달 동선 비효율',
    'proposed_solution', 'AI 동선 최적화 + 시민 봉사단 연계',
    'representative', '홍길동',
    'employees', 7,
    'website', 'https://example.com'
  ),
  'active'
from projects p
where p.slug = 'knu-2026'
  and not exists (
    select 1 from participants c
     where c.project_id = p.id
       and c.type = 'company'
       and c.name = '○○협동조합'
  )
returning id;
-- ⚠️ returning 으로 나온 company_id 를 기록해두세요. 아래 C-3에서 사용.

-- C-2. 기업 대표 Supabase Auth 가입 (Dashboard 또는 Magic Link 초대)
--      → 가입 완료 후 profiles 에 행 생성됨

-- C-3. company_members 매핑
insert into company_members (company_id, user_id, role)
select
  c.id,
  u.id,
  'owner'
from participants c, auth.users u
where c.project_id = (select id from projects where slug = 'knu-2026')
  and c.name = '○○협동조합'                  -- C-1에서 등록한 회사명
  and u.email = 'rep@company1.co.kr'         -- 기업 대표 이메일
on conflict (company_id, user_id) do nothing;

-- 확인: 기업별 운영자 목록
select c.name as company, pr.email, cm.role
  from company_members cm
  join participants c on c.id = cm.company_id
  join profiles pr on pr.id = cm.user_id
 where c.project_id = (select id from projects where slug = 'knu-2026')
 order by c.name;


-- =====================================================================
-- D. 청년 8명 등록 (선정 완료 시점)
-- =====================================================================

-- D-1. 청년 가입 (Auth) 후 participants에 등록 + user_id 연결
insert into participants (
  project_id, type, name, email, phone, organization,
  user_id, profile_data, status
)
select
  p.id, 'youth'::participant_type,
  '김학생',                                -- 청년 이름
  'student1@knu.ac.kr',
  '010-XXXX-XXXX',
  '경북대학교',
  u.id,                                    -- Auth user_id 자동 연결
  jsonb_build_object(
    'major', '컴퓨터학부',
    'grade', 3,
    'skills', array['React','Python','UX 리서치'],
    'interest_areas', array['고령자 돌봄','지역 모빌리티']
  ),
  'active'
from projects p, auth.users u
where p.slug = 'knu-2026'
  and u.email = 'student1@knu.ac.kr'      -- 청년 가입 이메일과 일치
  and not exists (
    select 1 from participants y
     where y.project_id = p.id
       and y.type = 'youth'
       and y.email = 'student1@knu.ac.kr'
  );

-- D-2. 기업-청년 매칭 (기업당 청년 2명)
insert into matchings (project_id, company_id, youth_ids)
select
  p.id,
  (select id from participants
     where project_id = p.id and name = '○○협동조합' and type = 'company'),
  array(
    select id from participants
     where project_id = p.id and type = 'youth'
       and email in ('student1@knu.ac.kr','student2@knu.ac.kr')
  )
from projects p where p.slug = 'knu-2026'
  and not exists (
    select 1 from matchings m
     where m.project_id = p.id
       and m.company_id = (
         select id from participants
          where project_id = p.id and name = '○○협동조합' and type = 'company'
       )
  );

-- 확인: 매칭 결과 시각화
select
  c.name as company,
  array_agg(y.name order by y.name) as matched_youths
from matchings m
join participants c on c.id = m.company_id
join participants y on y.id = any(m.youth_ids)
where m.project_id = (select id from projects where slug = 'knu-2026')
group by c.name;


-- =====================================================================
-- E. 권한 검증 — 가짜 사용자로 RLS 동작 확인
-- =====================================================================
--
-- Supabase Dashboard → SQL Editor 우상단 "Run as" 에서
-- "authenticated" 역할 + 특정 사용자 JWT로 실행하면 RLS 적용된 결과를 볼 수 있음

-- E-1. 기업 운영자 시야에서 student_proposals 조회
--     → 자기 회사로 온 제안만 보여야 함
select count(*) as visible_proposals from student_proposals;

-- E-2. 청년 시야에서 본인 제안 조회
--     → 본인이 작성한 제안만 보여야 함
select id, title, status, version from student_proposals;

-- E-3. 기업 운영자 시야에서 participants 조회
--     → 자기 회사 + 자기 회사에 매칭된 청년만 보여야 함
select name, type from participants;


-- =====================================================================
-- F. 학생 제안 라이프사이클 시뮬레이션 (테스트 시나리오)
-- =====================================================================
--
-- 정상 시나리오: draft → submitted → under_review → accepted

-- F-1. 청년이 제안 작성 (draft)
insert into student_proposals (
  project_id, company_id, author_id, title, content, category, status
)
select
  p.id,
  c.id,
  y.id,
  '키오스크 UI 단순화 제안',
  '고령자 사용성 테스트 결과 글자 크기 24pt 이상 + 음성 안내가 필수입니다.',
  'UX 개선',
  'draft'
from projects p
join participants c on c.project_id = p.id and c.name = '○○협동조합'
join participants y on y.project_id = p.id and y.email = 'student1@knu.ac.kr'
where p.slug = 'knu-2026'
limit 1;

-- F-2. 청년이 제출 (submitted)
update student_proposals set status = 'submitted'
 where title = '키오스크 UI 단순화 제안' and status = 'draft';

-- F-3. 기업이 검토 시작 (under_review)
update student_proposals set status = 'under_review'
 where title = '키오스크 UI 단순화 제안' and status = 'submitted';

-- F-4. 기업이 수정 요청 (needs_revision) - 피드백 필수
update student_proposals
   set status = 'needs_revision',
       company_feedback = '좋은 제안입니다. 다만 음성 안내 언어 옵션 (한국어/중국어/영어) 추가 검토 부탁드립니다.'
 where title = '키오스크 UI 단순화 제안' and status = 'under_review';

-- F-5. 청년이 다시 수정 후 재제출 (version 2로 자동 증가)
update student_proposals
   set content = '글자 24pt + 음성 안내 (한국어/중국어/영어 3개 언어 지원) 추가',
       status = 'submitted'
 where title = '키오스크 UI 단순화 제안' and status = 'needs_revision';

-- F-6. 기업이 최종 수용 (accepted)
update student_proposals
   set status = 'accepted',
       company_decision = '2026년 8월 MVP에 반영 예정'
 where title = '키오스크 UI 단순화 제안' and status = 'submitted';

-- 결과 확인
select title, status, version, submitted_at, reviewed_at, company_feedback, company_decision
  from student_proposals
 where title = '키오스크 UI 단순화 제안';


-- =====================================================================
-- G. 잘못된 전이 방지 검증 (트리거 동작 확인)
-- =====================================================================

-- G-1. accepted → draft 전이 시도 → 실패해야 함
-- update student_proposals set status = 'draft' where status = 'accepted';
-- ERROR: 확정 상태(accepted)는 더 이상 변경 불가

-- G-2. 거절 시 피드백 없이 시도 → 실패해야 함
-- update student_proposals set status = 'rejected', company_feedback = null where ...;
-- ERROR: 거절(rejected) 시 company_feedback 필수 (5자 이상)


-- =====================================================================
-- H. 운영 점검 쿼리 모음
-- =====================================================================

-- H-1. 프로젝트별 KPI 통합 조회
select * from project_kpis where slug = 'knu-2026';

-- H-2. 기업별 제안 진행 현황
select * from company_proposal_summary
 where project_id = (select id from projects where slug = 'knu-2026');

-- H-3. 검토 대기 중인 제안 (기업이 빠르게 응답해야 할 항목)
select
  c.name as company,
  sp.title,
  pr_y.email as student,
  sp.submitted_at,
  now() - sp.submitted_at as waiting_for
from student_proposals sp
join participants c on c.id = sp.company_id
join participants y on y.id = sp.author_id
left join profiles pr_y on pr_y.id = y.user_id
where sp.status = 'submitted'
order by sp.submitted_at;

-- H-4. AI 호출 누적 비용 (모델·에이전트별)
select
  model,
  agent_name,
  count(*)                                   as call_count,
  sum(prompt_tokens + completion_tokens)     as total_tokens,
  avg(duration_ms)::int                      as avg_duration_ms
from ai_calls_log
where created_at >= current_date - interval '7 days'
group by model, agent_name
order by total_tokens desc;
