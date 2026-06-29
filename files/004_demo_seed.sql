-- =====================================================================
-- AI Living Lab Platform · Demo Seed Data
-- Supabase SQL Editor에서 001, 002 적용 후 실행
--
-- 목적:
--   - 대시보드가 샘플이 아니라 Supabase 실데이터를 읽도록 기본 운영 데이터 생성
--   - 참여기업 4개사, 청년 8명, 기업-청년 매칭, 학생 제안, 시민 피드백,
--     예산 집행, 성과품 진행 상태를 데모 값으로 채움
--
-- 멱등성: project slug, 회사명, 청년 이메일, 제안 제목, respondent_token 기준 중복 방지
-- =====================================================================

-- 1. 참여기업 4개사
with project as (
  select id from projects where slug = 'knu-2026'
),
seed(name, email, phone, problem, solution, representative) as (
  values
    ('늘봄돌봄협동조합', 'contact@neulbom.example', '053-111-1001', '독거노인 식사 배달 동선 비효율', 'AI 동선 최적화와 시민 봉사단 연계', '김늘봄'),
    ('마을모빌리티사회적협동조합', 'hello@maeulmove.example', '053-111-1002', '교통약자 병원 이동 공백', '예약형 동행 이동 서비스', '박이동'),
    ('초록순환마켓', 'team@greenloop.example', '053-111-1003', '공동주택 재사용 물품 순환 저조', '동네 기반 물품 순환 플랫폼', '이초록'),
    ('청년식탁연구소', 'office@youthtable.example', '053-111-1004', '1인 청년 식생활 불균형', '지역 식재료 기반 공동 식탁 프로그램', '최식탁')
)
insert into participants (
  project_id, type, name, email, phone, organization, profile_data, status
)
select
  p.id,
  'company'::participant_type,
  s.name,
  s.email,
  s.phone,
  s.name,
  jsonb_build_object(
    'proposed_problem', s.problem,
    'proposed_solution', s.solution,
    'representative', s.representative,
    'employees', 6,
    'demo', true
  ),
  'active'::participant_status
from project p
cross join seed s
where not exists (
  select 1 from participants c
   where c.project_id = p.id
     and c.type = 'company'
     and c.name = s.name
);

-- 2. 청년 8명
with project as (
  select id from projects where slug = 'knu-2026'
),
seed(name, email, major, grade, skills) as (
  values
    ('김하린', 'student01@knu.example', '사회복지학부', 3, array['인터뷰','서비스기획','문서화']),
    ('이준서', 'student02@knu.example', '컴퓨터학부', 4, array['React','데이터분석','프로토타입']),
    ('박민지', 'student03@knu.example', '경영학부', 3, array['시장조사','BM 설계','발표']),
    ('최도윤', 'student04@knu.example', '디자인학과', 2, array['UX 리서치','Figma','사용성테스트']),
    ('정서연', 'student05@knu.example', '도시사회학과', 4, array['현장조사','퍼실리테이션','보고서']),
    ('강태오', 'student06@knu.example', '전자공학부', 3, array['IoT','센서','실험설계']),
    ('윤지아', 'student07@knu.example', '식품영양학과', 3, array['식생활조사','콘텐츠','커뮤니티']),
    ('한우진', 'student08@knu.example', '통계학과', 4, array['설문설계','통계분석','시각화'])
)
insert into participants (
  project_id, type, name, email, phone, organization, profile_data, status
)
select
  p.id,
  'youth'::participant_type,
  s.name,
  s.email,
  '010-0000-0000',
  '경북대학교',
  jsonb_build_object(
    'major', s.major,
    'grade', s.grade,
    'skills', s.skills,
    'demo', true
  ),
  'active'::participant_status
from project p
cross join seed s
where not exists (
  select 1 from participants y
   where y.project_id = p.id
     and y.type = 'youth'
     and y.email = s.email
);

-- 3. 기업-청년 매칭
with project as (
  select id from projects where slug = 'knu-2026'
),
seed(company_name, youth_emails) as (
  values
    ('늘봄돌봄협동조합', array['student01@knu.example','student02@knu.example']),
    ('마을모빌리티사회적협동조합', array['student03@knu.example','student04@knu.example']),
    ('초록순환마켓', array['student05@knu.example','student06@knu.example']),
    ('청년식탁연구소', array['student07@knu.example','student08@knu.example'])
)
insert into matchings (project_id, company_id, youth_ids, notes)
select
  p.id,
  c.id,
  array(
    select y.id
      from participants y
     where y.project_id = p.id
       and y.type = 'youth'
       and y.email = any(s.youth_emails)
     order by y.email
  ),
  'demo matching'
from project p
join seed s on true
join participants c
  on c.project_id = p.id
 and c.type = 'company'
 and c.name = s.company_name
where not exists (
  select 1 from matchings m
   where m.project_id = p.id
     and m.company_id = c.id
);

-- 4. 학생 제안: 먼저 submitted로 생성
with project as (
  select id from projects where slug = 'knu-2026'
),
seed(company_name, author_email, title, content, category) as (
  values
    ('늘봄돌봄협동조합', 'student01@knu.example', '배달 동선 체크인 화면 단순화', '봉사자가 첫 화면에서 오늘 방문 순서와 특이사항만 바로 확인하도록 제안합니다.', 'UX 개선'),
    ('늘봄돌봄협동조합', 'student02@knu.example', '어르신 안부 메모 자동 요약', '방문 후 음성 메모를 짧은 안부 기록으로 변환해 담당자가 빠르게 확인하게 합니다.', '기능 추가'),
    ('마을모빌리티사회적협동조합', 'student03@knu.example', '병원 동행 예약 흐름 개선', '보호자와 이용자가 같은 예약 상태를 볼 수 있는 공유 링크를 제안합니다.', '서비스 모델'),
    ('마을모빌리티사회적협동조합', 'student04@knu.example', '교통약자 탑승 전 안내 카드', '탑승 위치, 차량 정보, 준비물을 큰 글씨 안내 카드로 제공합니다.', 'UX 개선'),
    ('초록순환마켓', 'student05@knu.example', '재사용 물품 등록 기준표', '사진 품질과 품목 상태를 쉽게 판단하는 3단계 등록 기준표를 제안합니다.', '운영 개선'),
    ('초록순환마켓', 'student06@knu.example', '아파트 단지 순환 거점 지도', '단지 내 수거함과 교환 거점을 지도 기반으로 보여줍니다.', '기능 추가'),
    ('청년식탁연구소', 'student07@knu.example', '청년 식생활 자가진단 설문', '식사 빈도와 예산을 바탕으로 공동 식탁 추천 유형을 나눕니다.', '데이터 수집'),
    ('청년식탁연구소', 'student08@knu.example', '공동 식탁 만족도 분석판', '참여 후 만족도와 재참여 의향을 주차별로 추적합니다.', '성과관리')
)
insert into student_proposals (
  project_id, company_id, author_id, title, content, category, status
)
select
  p.id,
  c.id,
  y.id,
  s.title,
  s.content,
  s.category,
  'submitted'::proposal_status
from project p
join seed s on true
join participants c
  on c.project_id = p.id
 and c.type = 'company'
 and c.name = s.company_name
join participants y
  on y.project_id = p.id
 and y.type = 'youth'
 and y.email = s.author_email
where not exists (
  select 1 from student_proposals sp
   where sp.project_id = p.id
     and sp.title = s.title
);

-- 5. 제안 상태를 유효한 전이 규칙으로 데모 분산
update student_proposals
   set status = 'under_review'::proposal_status
 where title in ('어르신 안부 메모 자동 요약', '교통약자 탑승 전 안내 카드')
   and status = 'submitted'::proposal_status;

update student_proposals
   set status = 'under_review'::proposal_status
 where title in ('배달 동선 체크인 화면 단순화', '재사용 물품 등록 기준표', '청년 식생활 자가진단 설문')
   and status = 'submitted'::proposal_status;

update student_proposals
   set status = 'accepted'::proposal_status,
       company_decision = '8월 MVP 실증에 반영 예정'
 where title in ('배달 동선 체크인 화면 단순화', '청년 식생활 자가진단 설문')
   and status = 'under_review'::proposal_status;

update student_proposals
   set status = 'needs_revision'::proposal_status,
       company_feedback = '실증 참여자가 이해하기 쉬운 문장과 화면 예시를 1개 더 추가해 주세요.'
 where title = '재사용 물품 등록 기준표'
   and status = 'under_review'::proposal_status;

update student_proposals
   set status = 'rejected'::proposal_status,
       company_feedback = '현재 실증 범위와 맞지 않아 이번 MVP에서는 제외합니다.'
 where title = '병원 동행 예약 흐름 개선'
   and status = 'submitted'::proposal_status;

-- 6. 시민/사용자 피드백 샘플
with project as (
  select id from projects where slug = 'knu-2026'
),
seed(company_name, token, score, qualitative, channel) as (
  values
    ('늘봄돌봄협동조합', 'demo-feedback-001', 4.8, '방문 순서를 한눈에 볼 수 있어 편했습니다.', 'offline'),
    ('늘봄돌봄협동조합', 'demo-feedback-002', 4.7, '안부 기록이 짧게 정리되면 담당자가 보기 좋겠습니다.', 'qr'),
    ('늘봄돌봄협동조합', 'demo-feedback-003', 4.5, '글자가 더 크면 좋겠습니다.', 'qr'),
    ('마을모빌리티사회적협동조합', 'demo-feedback-004', 4.6, '예약 상태 공유가 필요합니다.', 'offline'),
    ('마을모빌리티사회적협동조합', 'demo-feedback-005', 4.4, '탑승 위치 안내가 명확해야 합니다.', 'qr'),
    ('마을모빌리티사회적협동조합', 'demo-feedback-006', 4.7, '보호자 알림이 있으면 안심됩니다.', 'qr'),
    ('초록순환마켓', 'demo-feedback-007', 4.3, '등록 기준이 있으면 참여하기 쉬울 것 같습니다.', 'online'),
    ('초록순환마켓', 'demo-feedback-008', 4.6, '단지별 교환 장소가 보이면 좋겠습니다.', 'qr'),
    ('초록순환마켓', 'demo-feedback-009', 4.5, '사진 예시가 필요합니다.', 'offline'),
    ('청년식탁연구소', 'demo-feedback-010', 4.9, '자가진단 결과가 흥미롭습니다.', 'online'),
    ('청년식탁연구소', 'demo-feedback-011', 4.8, '같은 관심사의 참여자를 만날 수 있어 좋았습니다.', 'qr'),
    ('청년식탁연구소', 'demo-feedback-012', 4.7, '다음 모임 일정 안내가 필요합니다.', 'qr')
)
insert into user_feedback (
  project_id,
  company_id,
  respondent_token,
  quantitative,
  qualitative,
  channel
)
select
  p.id,
  c.id,
  s.token,
  jsonb_build_object('overall_satisfaction', s.score),
  s.qualitative,
  s.channel
from project p
join seed s on true
join participants c
  on c.project_id = p.id
 and c.type = 'company'
 and c.name = s.company_name
where not exists (
  select 1 from user_feedback uf
   where uf.project_id = p.id
     and uf.respondent_token = s.token
);

-- 7. 예산 집행 샘플
update budget_items
   set executed_amount = case category
     when '인건비' then 800000
     when '운영비' then 1200000
     when '실증비' then 3000000
     when '전문가' then 900000
     when '성과공유회' then 0
     when '제작비' then 250000
     when '예비비' then 0
     else executed_amount
   end
 where project_id = (select id from projects where slug = 'knu-2026');

-- 8. 성과품 진행 상태 샘플
update deliverables
   set status = case type
     when 'kickoff_plan' then 'approved'::deliverable_status
     when 'problem_definition' then 'in_review'::deliverable_status
     when 'validation_plan' then 'draft'::deliverable_status
     when 'validation_report' then 'draft'::deliverable_status
     when 'final_report' then 'draft'::deliverable_status
     when 'activity_photos' then 'in_review'::deliverable_status
     when 'settlement' then 'draft'::deliverable_status
     else status
   end,
   file_format = coalesce(file_format, 'PDF/HWPX')
 where project_id = (select id from projects where slug = 'knu-2026')
   and company_id is null;

-- 9. 확인
select * from project_kpis where slug = 'knu-2026';

select *
  from company_proposal_summary
 where project_id = (select id from projects where slug = 'knu-2026')
 order by company_name;
