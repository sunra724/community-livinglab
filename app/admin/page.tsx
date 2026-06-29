import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileText,
  Landmark,
  MessageSquareText,
  PenLine,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards
} from "lucide-react";
import {
  addParticipantAction,
  reviewProposalAction,
  saveMatchingAction,
  updateBudgetAction,
  updateDeliverableAction
} from "@/app/admin/actions";
import {
  deliverableStatusOptions,
  getAdminAccess,
  getAdminData,
  proposalReviewOptions,
  type AdminData
} from "@/lib/admin-data";
import { getCurrentUserContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const userContext = await getCurrentUserContext();
  const access = getAdminAccess(params.key, userContext.canOperateProject);
  const notice = getParam(params.notice);
  const noticeLevel = getParam(params.level) === "error" ? "error" : "success";
  const data = await getAdminData();
  const companies = data.participants.filter((item) => item.type === "company");
  const youths = data.participants.filter((item) => item.type === "youth");
  const pendingProposals = data.proposals.filter((item) =>
    ["submitted", "under_review"].includes(item.status)
  );
  const reportDraft = buildWeeklyReport(data);

  return (
    <div className="ops-shell">
      <header className="ops-hero">
        <div>
          <p className="ops-eyebrow">SOILAB OPERATIONS</p>
          <h1>커뮤니티 리빙랩 운영 액션센터</h1>
          <p>
            참여자 등록, 매칭, 제안 검토, 예산 입력, 성과품 상태 변경과 보고서 초안 생성을
            한 화면에서 처리합니다.
          </p>
        </div>
        <div className="ops-hero-actions">
          <Link href={userContext.isAuthenticated ? "/portal" : "/login"}>
            <ShieldCheck size={16} />
            {userContext.isAuthenticated ? "내 포털" : "로그인"}
          </Link>
          <Link href="/dashboard">
            <ArrowUpRight size={16} />
            상황판 보기
          </Link>
          <span className={`ops-connection ${data.connection.mode}`}>
            <ShieldCheck size={16} />
            {data.connection.label}
          </span>
        </div>
      </header>

      {notice ? (
        <div className={`ops-notice ${noticeLevel}`} role="status">
          {notice}
        </div>
      ) : null}

      {!access.authorized ? (
        <section className="ops-lock">
          <div>
            <p className="ops-eyebrow">WRITE ACCESS</p>
            <h2>쓰기 기능 잠금</h2>
            <p>{access.message}</p>
          </div>
          {access.needsCode ? (
            <form>
              <label htmlFor="admin-key">관리자 코드</label>
              <div className="inline-fields">
                <input id="admin-key" name="key" type="password" placeholder="ADMIN_ACCESS_CODE" />
                <button type="submit">열기</button>
              </div>
            </form>
          ) : null}
        </section>
      ) : (
        <section className="ops-unlocked">
          <BadgeCheck size={17} />
          <span>{access.message}</span>
        </section>
      )}

      <section className="ops-metrics" aria-label="운영 요약">
        <MetricCard icon={Building2} label="참여기업" value={`${companies.length}곳`} />
        <MetricCard icon={UsersRound} label="청년 참여자" value={`${youths.length}명`} />
        <MetricCard icon={MessageSquareText} label="검토 대기 제안" value={`${pendingProposals.length}건`} />
        <MetricCard icon={FileText} label="성과품" value={`${data.deliverables.length}종`} />
      </section>

      <main className="ops-grid">
        <section className="ops-panel ops-span-2">
          <PanelTitle icon={PenLine} title="참여자 등록" aside="기업 또는 청년" />
          <form action={addParticipantAction} className="ops-form">
            <AdminCodeField code={access.code} />
            <fieldset disabled={!access.authorized}>
              <div className="form-grid">
                <label>
                  구분
                  <select name="type" required>
                    <option value="company">참여기업</option>
                    <option value="youth">청년 참여자</option>
                  </select>
                </label>
                <label>
                  이름
                  <input name="name" required placeholder="기업명 또는 성명" />
                </label>
                <label>
                  이메일
                  <input name="email" type="email" placeholder="name@example.com" />
                </label>
                <label>
                  연락처
                  <input name="phone" placeholder="010-0000-0000" />
                </label>
                <label>
                  소속
                  <input name="organization" placeholder="기업명 또는 경북대학교" />
                </label>
                <label>
                  대표자
                  <input name="representative" placeholder="기업일 때 입력" />
                </label>
                <label className="wide-field">
                  제안 문제
                  <textarea name="problem" rows={3} placeholder="기업이 해결하고 싶은 지역문제" />
                </label>
                <label className="wide-field">
                  제안 솔루션
                  <textarea name="solution" rows={3} placeholder="현재 구상 중인 해결 방향" />
                </label>
                <label>
                  전공
                  <input name="major" placeholder="청년일 때 입력" />
                </label>
                <label>
                  학년
                  <input name="grade" placeholder="예: 3" />
                </label>
                <label className="wide-field">
                  역량
                  <input name="skills" placeholder="인터뷰, Figma, 데이터분석" />
                </label>
              </div>
              <button type="submit">참여자 등록</button>
            </fieldset>
          </form>
        </section>

        <section className="ops-panel">
          <PanelTitle icon={Landmark} title="기업-청년 매칭" aside={`${data.matchings.length}팀`} />
          <form action={saveMatchingAction} className="ops-form">
            <AdminCodeField code={access.code} />
            <fieldset disabled={!access.authorized}>
              <label>
                참여기업
                <select name="companyId" required>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                청년 선택
                <select name="youthIds" multiple required size={Math.min(Math.max(youths.length, 3), 8)}>
                  {youths.map((youth) => (
                    <option key={youth.id} value={youth.id}>
                      {youth.name} · {youth.organization ?? "소속 미입력"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                메모
                <textarea name="notes" rows={3} placeholder="매칭 사유 또는 역할 분담" />
              </label>
              <button type="submit">매칭 저장</button>
            </fieldset>
          </form>
          <div className="compact-list">
            {data.matchings.map((matching) => (
              <MatchingRow data={data} key={matching.id} matchingId={matching.id} />
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <PanelTitle icon={FileText} title="성과품 상태" aside="7종 관리" />
          <form action={updateDeliverableAction} className="ops-form">
            <AdminCodeField code={access.code} />
            <fieldset disabled={!access.authorized}>
              <label>
                성과품
                <select name="deliverableId" required>
                  {data.deliverables.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {statusLabel(item.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                상태
                <select name="status" required>
                  {deliverableStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                파일 형식
                <input name="fileFormat" placeholder="PDF/HWPX" />
              </label>
              <label>
                파일 URL
                <input name="fileUrl" type="url" placeholder="https://..." />
              </label>
              <button type="submit">성과품 저장</button>
            </fieldset>
          </form>
          <div className="status-stack">
            {data.deliverables.map((item) => (
              <StatusRow
                key={item.id}
                label={item.title}
                value={statusLabel(item.status)}
                tone={statusTone(item.status)}
              />
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <PanelTitle icon={MessageSquareText} title="학생 제안 검토" aside={`${pendingProposals.length}건 대기`} />
          <form action={reviewProposalAction} className="ops-form">
            <AdminCodeField code={access.code} />
            <fieldset disabled={!access.authorized}>
              <label>
                제안
                <select name="proposalId" required>
                  {data.proposals.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposal.companyName} · {proposal.title} · {statusLabel(proposal.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                처리
                <select name="status" required>
                  {proposalReviewOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                의사결정 메모
                <input name="decision" placeholder="예: 8월 MVP 반영 예정" />
              </label>
              <label>
                피드백
                <textarea name="feedback" rows={4} placeholder="수정요청 또는 거절 사유" />
              </label>
              <button type="submit">제안 검토 저장</button>
            </fieldset>
          </form>
          <div className="proposal-preview-list">
            {data.proposals.slice(0, 4).map((proposal) => (
              <article key={proposal.id}>
                <span>{proposal.companyName}</span>
                <strong>{proposal.title}</strong>
                <p>{proposal.content}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-panel">
          <PanelTitle icon={WalletCards} title="예산 집행 입력" aside={formatWon(sum(data.budget, "executedAmount"))} />
          <form action={updateBudgetAction} className="ops-form">
            <AdminCodeField code={access.code} />
            <fieldset disabled={!access.authorized}>
              <label>
                예산 항목
                <select name="budgetId" required>
                  {data.budget.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.category} · {formatWon(item.executedAmount)} / {formatWon(item.plannedAmount)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                집행 누계
                <input name="executedAmount" type="number" min="0" step="1000" required placeholder="1200000" />
              </label>
              <label>
                집행일
                <input name="executedAt" type="date" />
              </label>
              <label>
                지급처
                <input name="payee" placeholder="거래처 또는 수령자" />
              </label>
              <label>
                증빙 URL
                <input name="evidenceUrl" type="url" placeholder="https://..." />
              </label>
              <button type="submit">예산 저장</button>
            </fieldset>
          </form>
          <div className="budget-bars">
            {data.budget.map((item) => (
              <div key={item.id}>
                <span>{item.category}</span>
                <div>
                  <i style={{ width: `${Math.min((item.executedAmount / item.plannedAmount) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ops-panel ops-span-2">
          <PanelTitle icon={Sparkles} title="주간보고 초안" aside="복사해서 편집" />
          <textarea className="report-draft" readOnly value={reportDraft} />
        </section>
      </main>
    </div>
  );
}

function AdminCodeField({ code }: { code: string }) {
  return <input name="adminCode" type="hidden" value={code} />;
}

function PanelTitle({
  icon: Icon,
  title,
  aside
}: {
  icon: typeof Building2;
  title: string;
  aside: string;
}) {
  return (
    <div className="ops-panel-title">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      <span>{aside}</span>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="ops-metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MatchingRow({ data, matchingId }: { data: AdminData; matchingId: string }) {
  const matching = data.matchings.find((item) => item.id === matchingId);
  if (!matching) return null;

  const company = data.participants.find((item) => item.id === matching.companyId);
  const youthNames = matching.youthIds
    .map((id) => data.participants.find((item) => item.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <strong>{company?.name ?? "기업 미지정"}</strong>
      <span>{youthNames || "청년 미지정"}</span>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong className={`status-chip ${tone}`}>{value}</strong>
    </div>
  );
}

function buildWeeklyReport(data: AdminData) {
  const companies = data.participants.filter((item) => item.type === "company");
  const youths = data.participants.filter((item) => item.type === "youth");
  const accepted = data.proposals.filter((item) => item.status === "accepted").length;
  const pending = data.proposals.filter((item) => ["submitted", "under_review"].includes(item.status)).length;
  const budgetExecuted = sum(data.budget, "executedAmount");
  const budgetPlanned = sum(data.budget, "plannedAmount");

  return [
    `# ${data.project.name} 주간 운영보고 초안`,
    "",
    "## 1. 운영 현황",
    `- 참여기업: ${companies.length}곳`,
    `- 청년 참여자: ${youths.length}명`,
    `- 기업-청년 매칭: ${data.matchings.length}팀`,
    `- 학생 제안: 총 ${data.proposals.length}건, 수용 ${accepted}건, 검토 대기 ${pending}건`,
    `- 예산 집행: ${formatWon(budgetExecuted)} / ${formatWon(budgetPlanned)}`,
    "",
    "## 2. 이번 주 주요 진행",
    ...data.events.slice(0, 4).map((event) => `- ${event.title}: ${formatDate(event.scheduledAt)} / ${event.location ?? "-"}`),
    "",
    "## 3. 검토 필요",
    ...data.proposals
      .filter((proposal) => ["submitted", "under_review", "needs_revision"].includes(proposal.status))
      .slice(0, 5)
      .map((proposal) => `- ${proposal.companyName}: ${proposal.title} (${statusLabel(proposal.status)})`),
    "",
    "## 4. 성과품 상태",
    ...data.deliverables.map((item) => `- ${item.title}: ${statusLabel(item.status)}`),
    "",
    "## 5. 다음 액션",
    "- 기업별 문제정의서 보완 여부 확인",
    "- 실증 참여자 모집 채널과 QR 피드백 동선 점검",
    "- 제출 예정 성과품 파일 URL 및 증빙자료 정리"
  ].join("\n");
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

function sum(items: AdminData["budget"], key: "plannedAmount" | "executedAmount") {
  return items.reduce((total, item) => total + item[key], 0);
}

function formatWon(value: number) {
  if (!value) return "0원";
  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  });
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
