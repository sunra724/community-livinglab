import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import {
  companyReviewProposalAction,
  createYouthProposalAction,
  signOutAction
} from "@/app/portal/actions";
import { getCurrentUserContext, type PortalRole } from "@/lib/auth-context";
import { getPortalData, type PortalData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

type PortalPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const context = await getCurrentUserContext();

  if (!context.isAuthenticated) {
    redirect("/login");
  }

  const data = await getPortalData();
  const params = (await searchParams) ?? {};
  const message = getParam(params.message);
  const level = getParam(params.level) === "error" ? "error" : "success";

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div>
          <p className="ops-eyebrow">{roleLabel(context.role)}</p>
          <h1>{data.project.name}</h1>
          <p>{context.user?.name}님이 오늘 처리할 업무만 모아서 보여줍니다.</p>
        </div>
        <div className="portal-actions">
          <Link href="/dashboard">
            <LayoutDashboard size={16} />
            상황판
          </Link>
          {context.canOperateProject ? (
            <Link href="/admin">
              <PenLine size={16} />
              운영 입력
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button type="submit">
              <LogOut size={16} />
              로그아웃
            </button>
          </form>
        </div>
      </header>

      {message ? <div className={`ops-notice ${level}`}>{message}</div> : null}

      {context.canOperateProject ? (
        <OperatorPortal data={data} role={context.role} />
      ) : context.role === "company_owner" ? (
        <CompanyPortal data={data} />
      ) : context.role === "youth_member" ? (
        <YouthPortal data={data} />
      ) : (
        <ViewerPortal data={data} role={context.role} />
      )}
    </div>
  );
}

function OperatorPortal({ data, role }: { data: PortalData; role: PortalRole }) {
  const companies = data.participants.filter((item) => item.type === "company");
  const youths = data.participants.filter((item) => item.type === "youth");
  const pending = data.proposals.filter((proposal) =>
    ["submitted", "under_review", "needs_revision"].includes(proposal.status)
  );
  const adminActionLabel =
    role === "super_admin"
      ? "참여자 등록, 매칭, 예산, 성과품 상태 입력"
      : "참여자 등록, 매칭, 성과품 상태 입력";

  return (
    <main className="portal-grid">
      <PortalMetric icon={ShieldCheck} label="접속 권한" value={roleLabel(role)} />
      <PortalMetric icon={Building2} label="참여기업" value={`${companies.length}곳`} />
      <PortalMetric icon={UsersRound} label="청년 참여자" value={`${youths.length}명`} />
      <PortalMetric icon={MessageSquareText} label="검토 필요" value={`${pending.length}건`} />

      <section className="portal-panel portal-span-2">
        <PortalTitle icon={ClipboardList} title="운영진 다음 액션" />
        <div className="portal-action-list">
          <Link href="/admin">
            <PenLine size={17} />
            {adminActionLabel}
          </Link>
          <Link href="/dashboard">
            <LayoutDashboard size={17} />
            전체 KPI와 사업 진행 상황 확인
          </Link>
        </div>
      </section>

      <section className="portal-panel">
        <PortalTitle icon={MessageSquareText} title="검토 큐" />
        <div className="portal-list">
          {pending.slice(0, 6).map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
          {pending.length === 0 ? <EmptyState text="현재 검토할 제안이 없습니다." /> : null}
        </div>
      </section>

      <section className="portal-panel">
        <PortalTitle icon={FileText} title="성과품 상태" />
        <div className="portal-list">
          {data.deliverables.map((item) => (
            <StatusLine key={item.id} label={item.title} status={item.status} />
          ))}
        </div>
      </section>
    </main>
  );
}

function CompanyPortal({ data }: { data: PortalData }) {
  const companies = data.participants.filter((item) => item.type === "company");
  const youths = data.participants.filter((item) => item.type === "youth");
  const reviewable = data.proposals.filter((proposal) =>
    ["submitted", "under_review"].includes(proposal.status)
  );

  return (
    <main className="portal-grid">
      <PortalMetric icon={Building2} label="내 기업" value={companies[0]?.name ?? "매핑 필요"} />
      <PortalMetric icon={UsersRound} label="매칭 청년" value={`${youths.length}명`} />
      <PortalMetric icon={MessageSquareText} label="도착 제안" value={`${data.proposals.length}건`} />
      <PortalMetric icon={CheckCircle2} label="수용 제안" value={`${data.proposals.filter((item) => item.status === "accepted").length}건`} />

      <section className="portal-panel">
        <PortalTitle icon={UsersRound} title="매칭 청년" />
        <div className="portal-list">
          {youths.map((youth) => (
            <PersonLine key={youth.id} name={youth.name} meta={youth.organization ?? youth.email ?? "-"} />
          ))}
          {youths.length === 0 ? <EmptyState text="아직 청년 매칭이 없습니다." /> : null}
        </div>
      </section>

      <section className="portal-panel">
        <PortalTitle icon={MessageSquareText} title="제안 검토" />
        {reviewable.length > 0 ? (
          <form action={companyReviewProposalAction} className="portal-form">
            <label>
              제안 선택
              <select name="proposalId" required>
                {reviewable.map((proposal) => (
                  <option key={proposal.id} value={proposal.id}>
                    {proposal.title} · {statusLabel(proposal.status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              처리
              <select name="status" required>
                <option value="under_review">검토중</option>
                <option value="accepted">수용</option>
                <option value="needs_revision">수정요청</option>
                <option value="rejected">거절</option>
              </select>
            </label>
            <label>
              결정 메모
              <input name="decision" placeholder="예: MVP 반영 예정" />
            </label>
            <label>
              피드백
              <textarea name="feedback" rows={4} placeholder="수정요청 또는 거절 사유" />
            </label>
            <button type="submit">검토 저장</button>
          </form>
        ) : (
          <EmptyState text="현재 검토 가능한 제안이 없습니다." />
        )}
      </section>

      <section className="portal-panel portal-span-2">
        <PortalTitle icon={ClipboardList} title="받은 제안" />
        <div className="portal-card-grid">
          {data.proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      </section>
    </main>
  );
}

function YouthPortal({ data }: { data: PortalData }) {
  const companies = data.participants.filter((item) => item.type === "company");
  const myYouth = data.participants.find((item) => item.type === "youth");

  return (
    <main className="portal-grid">
      <PortalMetric icon={UsersRound} label="내 프로필" value={myYouth?.name ?? "매핑 필요"} />
      <PortalMetric icon={Building2} label="매칭 기업" value={`${companies.length}곳`} />
      <PortalMetric icon={MessageSquareText} label="내 제안" value={`${data.proposals.length}건`} />
      <PortalMetric icon={CheckCircle2} label="수용" value={`${data.proposals.filter((item) => item.status === "accepted").length}건`} />

      <section className="portal-panel">
        <PortalTitle icon={Building2} title="매칭 기업" />
        <div className="portal-list">
          {companies.map((company) => (
            <PersonLine key={company.id} name={company.name} meta={company.email ?? company.organization ?? "-"} />
          ))}
          {companies.length === 0 ? <EmptyState text="아직 매칭된 기업이 없습니다." /> : null}
        </div>
      </section>

      <section className="portal-panel">
        <PortalTitle icon={PenLine} title="기업 제안 작성" />
        {companies.length > 0 ? (
          <form action={createYouthProposalAction} className="portal-form">
            <label>
              제안 대상 기업
              <select name="companyId" required>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              제목
              <input name="title" required placeholder="예: 서비스 예약 흐름 개선" />
            </label>
            <label>
              카테고리
              <input name="category" placeholder="UX 개선, 기능 추가, 운영 개선" />
            </label>
            <label>
              제안 내용
              <textarea name="content" rows={5} required placeholder="현장조사 근거와 개선안을 적어 주세요." />
            </label>
            <button type="submit">제안 제출</button>
          </form>
        ) : (
          <EmptyState text="매칭 기업이 생기면 제안을 제출할 수 있습니다." />
        )}
      </section>

      <section className="portal-panel portal-span-2">
        <PortalTitle icon={MessageSquareText} title="내 제안 현황" />
        <div className="portal-card-grid">
          {data.proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
          {data.proposals.length === 0 ? <EmptyState text="아직 제출한 제안이 없습니다." /> : null}
        </div>
      </section>
    </main>
  );
}

function ViewerPortal({ data, role }: { data: PortalData; role: PortalRole }) {
  return (
    <main className="portal-grid">
      <PortalMetric icon={ShieldCheck} label="접속 권한" value={roleLabel(role)} />
      <section className="portal-panel portal-span-2">
        <PortalTitle icon={ClipboardList} title="사용자 매핑 필요" />
        <p className="portal-muted">
          로그인은 되었지만 프로젝트 역할, 기업 운영자, 청년 참여자 매핑이 아직 없습니다. Supabase에서
          `user_project_roles`, `company_members`, 또는 `participants.user_id`를 연결해 주세요.
        </p>
      </section>
    </main>
  );
}

function PortalMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="portal-metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PortalTitle({
  icon: Icon,
  title
}: {
  icon: typeof Building2;
  title: string;
}) {
  return (
    <div className="portal-title">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  );
}

function PersonLine({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="person-line">
      <strong>{name}</strong>
      <span>{meta}</span>
    </div>
  );
}

function StatusLine({ label, status }: { label: string; status: string }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong className={`status-chip ${statusTone(status)}`}>{statusLabel(status)}</strong>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: PortalData["proposals"][number] }) {
  return (
    <article className="portal-proposal">
      <div>
        <span>{proposal.companyName}</span>
        <strong>{proposal.title}</strong>
        <em>{proposal.authorName}</em>
      </div>
      <p>{proposal.content}</p>
      <footer>
        <strong className={`status-chip ${statusTone(proposal.status)}`}>{statusLabel(proposal.status)}</strong>
        {proposal.companyFeedback ? <span>{proposal.companyFeedback}</span> : null}
      </footer>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="portal-empty">{text}</p>;
}

function roleLabel(role: PortalRole) {
  const labels: Record<PortalRole, string> = {
    anonymous: "비로그인",
    super_admin: "슈퍼관리자",
    admin: "운영 관리자",
    manager: "프로젝트 매니저",
    facilitator: "퍼실리테이터",
    viewer: "조회 사용자",
    company_owner: "참여기업",
    youth_member: "청년 참여자"
  };

  return labels[role];
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "작성전",
    ai_generated: "AI 생성",
    in_review: "검토중",
    approved: "승인",
    submitted: "제출",
    under_review: "검토중",
    needs_revision: "수정요청",
    accepted: "수용",
    rejected: "거절"
  };

  return labels[status] ?? status;
}

function statusTone(status: string) {
  if (["approved", "accepted", "submitted"].includes(status)) return "green";
  if (["in_review", "under_review", "needs_revision"].includes(status)) return "amber";
  if (["rejected"].includes(status)) return "rose";
  return "neutral";
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
