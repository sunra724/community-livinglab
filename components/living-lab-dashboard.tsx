import {
  Archive,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  Handshake,
  Home,
  Landmark,
  Link2,
  Megaphone,
  MessageSquareText,
  QrCode,
  ReceiptText,
  Settings,
  ShieldCheck,
  UploadCloud,
  UsersRound,
  WalletCards
} from "lucide-react";
import type {
  BudgetItem,
  CompanyProposalSummary,
  DashboardData,
  DashboardKpi,
  DeliverableItem,
  TimelineItem,
  WorkshopEvent,
  Workstream
} from "@/lib/dashboard-data";

const navItems = [
  { label: "사업 상황판", icon: Home, active: true },
  { label: "사업흐름/과업", icon: ClipboardList },
  { label: "활동증빙", icon: UploadCloud },
  { label: "홍보 자동화", icon: Megaphone },
  { label: "리마인드 문자", icon: Bell },
  { label: "검토/거버넌스", icon: ShieldCheck },
  { label: "보고서 묶음", icon: Archive },
  { label: "참여자 관리", icon: UsersRound },
  { label: "교육/출석", icon: CalendarDays },
  { label: "강의증빙", icon: BookOpenCheck },
  { label: "QR 테스트", icon: QrCode },
  { label: "참여기업 관리", icon: BriefcaseBusiness },
  { label: "현장연계", icon: Link2 },
  { label: "예산 참조", icon: Landmark },
  { label: "설정", icon: Settings }
];

const kpiIcons: Record<string, typeof Building2> = {
  companies: Building2,
  youths: UsersRound,
  citizens: Handshake,
  satisfaction: Gauge,
  deliverables: FileText,
  budget: WalletCards
};

const statusLabel: Record<string, string> = {
  draft: "작성전",
  ai_generated: "AI 생성",
  in_review: "검토중",
  approved: "승인",
  submitted: "제출",
  planned: "예정",
  active: "진행중",
  completed: "완료"
};

const timelineLabel: Record<TimelineItem["status"], string> = {
  done: "완료",
  active: "진행중",
  next: "진행중",
  planned: "계획"
};

const workstreamLabel: Record<Workstream["status"], string> = {
  ready: "정상",
  watch: "점검",
  blocked: "보완"
};

export function LivingLabDashboard({ data }: { data: DashboardData }) {
  const totalPlanned = data.budget.reduce((sum, item) => sum + item.planned, 0);
  const totalExecuted = data.budget.reduce((sum, item) => sum + item.executed, 0);
  const budgetProgress = totalPlanned ? Math.round((totalExecuted / totalPlanned) * 100) : 0;
  const reviewQueue = buildReviewQueue(data.companies, data.deliverables);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <strong>Living Lab</strong>
          <span>사업관리/운영거버넌스</span>
        </div>

        <nav className="sidebar-nav" aria-label="운영콘솔 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a className={item.active ? "active" : undefined} href="#overview" key={item.label}>
                <Icon size={16} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <strong>커뮤니티 리빙랩 운영콘솔</strong>
            <span>모집, 매칭, 워크숍, 실증, 보고를 하나의 사업 흐름으로 관리</span>
          </div>
        </header>

        <section className="admin-board" id="overview">
          <div className="board-heading">
            <div>
              <h1>사업 상황판</h1>
              <p>
                참여기업, 청년 매칭, 실증 참여자, 성과품과 검토 대기 상태를 한 화면에서 확인합니다.
              </p>
            </div>
            <div className="board-actions">
              <button type="button">
                <ClipboardCheck size={15} />
                활동증빙 보기
              </button>
              <button type="button">
                <QrCode size={15} />
                QR 테스트
              </button>
              <button className="primary" type="button">
                <FileCheck2 size={15} />
                보고서 묶음
              </button>
            </div>
          </div>

          <section className="kpi-grid" aria-label="핵심 지표">
            {data.kpis.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </section>

          <section className="admin-grid main-grid">
            <div className="panel flow-panel" id="timeline">
              <PanelHeading icon={ClipboardList} title="리빙랩 사업흐름" aside="과업 진행" />
              <div className="flow-list">
                {data.timeline.map((item, index) => (
                  <FlowRow
                    item={item}
                    index={index}
                    key={item.label}
                    workshop={data.workshops[index]}
                  />
                ))}
              </div>
            </div>

            <div className="panel review-panel" id="proposals">
              <PanelHeading icon={ShieldCheck} title="검토 큐" aside={`${reviewQueue.length}건`} />
              <div className="review-list">
                {reviewQueue.map((item) => (
                  <ReviewItem item={item} key={`${item.title}-${item.kind}`} />
                ))}
              </div>
            </div>
          </section>

          <section className="admin-grid lower-grid">
            <div className="panel" id="workshops">
              <PanelHeading icon={CalendarDays} title="워크숍·교육 일정" aside={`${data.workshops.length}회차`} />
              <WorkshopTable events={data.workshops} />
            </div>

            <div className="panel">
              <PanelHeading icon={WalletCards} title="예산 집행" aside={`${budgetProgress}%`} />
              <div className="budget-total">
                <strong>{formatCurrency(totalExecuted)}</strong>
                <span>{formatCurrency(totalPlanned)}</span>
              </div>
              <div className="budget-list">
                {data.budget.map((item) => (
                  <BudgetRow item={item} key={item.category} />
                ))}
              </div>
            </div>
          </section>

          <section className="admin-grid lower-grid">
            <div className="panel" id="deliverables">
              <PanelHeading icon={Archive} title="보고서 묶음" aside={`${data.deliverables.length}종`} />
              <div className="deliverable-list">
                {data.deliverables.map((item) => (
                  <DeliverableRow item={item} key={`${item.type}-${item.title}`} />
                ))}
              </div>
            </div>

            <div className="panel">
              <PanelHeading icon={Database} title="연결 상태" aside={data.connection.label} />
              <div className={`connection-box ${data.connection.mode}`}>
                <Database size={18} />
                <div>
                  <strong>{data.connection.label}</strong>
                  <span>{data.connection.detail}</span>
                </div>
              </div>
              <div className="workstream-list">
                {data.workstreams.map((item) => (
                  <WorkstreamRow item={item} key={item.name} />
                ))}
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: DashboardKpi }) {
  const Icon = kpiIcons[kpi.key] ?? Gauge;

  return (
    <article className={`kpi-card tone-${kpi.tone}`}>
      <div className="kpi-topline">
        <span>{kpi.label}</span>
        <div className="metric-icon">
          <Icon size={17} />
        </div>
      </div>
      <strong>{kpi.value}</strong>
      <p>{kpi.detail}</p>
      <div className="progress-track" aria-label={`${kpi.label} 진행률 ${Math.round(kpi.progress)}%`}>
        <span style={{ width: `${kpi.progress}%` }} />
      </div>
    </article>
  );
}

function PanelHeading({
  icon: Icon,
  title,
  aside
}: {
  icon: typeof CalendarDays;
  title: string;
  aside: string;
}) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <span>
        <Icon size={14} />
        {aside}
      </span>
    </div>
  );
}

function FlowRow({
  item,
  index,
  workshop
}: {
  item: TimelineItem;
  index: number;
  workshop?: WorkshopEvent;
}) {
  const progress = item.status === "done" ? 100 : item.status === "active" ? 72 : item.status === "next" ? 38 : 12;
  const code = `LL-${String(index + 1).padStart(2, "0")}`;

  return (
    <article className="flow-row">
      <div className="flow-copy">
        <div>
          <span className="work-code">{code}</span>
          <em className={`status-chip ${item.status}`}>{timelineLabel[item.status]}</em>
        </div>
        <h3>{item.label}</h3>
        <p>{workshop?.title ?? "운영 일정 및 담당자 점검"}</p>
        <small>{item.range}</small>
      </div>
      <div className="flow-progress">
        <div>
          <span>{progress}%</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p>필수 증빙: 회의록, 사진, 출석, 결과 메모</p>
      </div>
    </article>
  );
}

function ReviewItem({ item }: { item: ReviewQueueItem }) {
  return (
    <article className="review-item">
      <div>
        <em className={item.urgent ? "status-chip alert" : "status-chip approved"}>{item.kind}</em>
        <span>{item.due}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <small>{item.owner}</small>
    </article>
  );
}

function WorkshopTable({ events }: { events: WorkshopEvent[] }) {
  return (
    <div className="data-table">
      <div className="table-head workshop-grid">
        <span>회차</span>
        <span>주제</span>
        <span>일시</span>
        <span>장소</span>
      </div>
      {events.map((event) => (
        <div className="table-row workshop-grid" key={event.sessionNo}>
          <span>{event.sessionNo}회차</span>
          <strong>{event.title}</strong>
          <span>{event.date}</span>
          <span>{event.location}</span>
        </div>
      ))}
    </div>
  );
}

function BudgetRow({ item }: { item: BudgetItem }) {
  const progress = item.planned ? Math.min(100, (item.executed / item.planned) * 100) : 0;

  return (
    <div className="budget-row">
      <div className="row-title">
        <strong>{item.category}</strong>
        <span>{formatCurrency(item.planned)}</span>
      </div>
      <div className="progress-track compact">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function DeliverableRow({ item }: { item: DeliverableItem }) {
  return (
    <div className="deliverable-row">
      <div className="file-icon">
        <FileText size={16} />
      </div>
      <div>
        <strong>{item.title}</strong>
        <span>{item.format}</span>
      </div>
      <em className={`status-chip ${item.status}`}>{statusLabel[item.status] ?? item.status}</em>
    </div>
  );
}

function WorkstreamRow({ item }: { item: Workstream }) {
  const Icon = item.status === "ready" ? CheckCircle2 : ClipboardCheck;

  return (
    <div className="workstream-row">
      <Icon size={16} />
      <div>
        <strong>{item.name}</strong>
        <p>{item.owner}</p>
        <small>
          {workstreamLabel[item.status]} · {item.note}
        </small>
      </div>
    </div>
  );
}

type ReviewQueueItem = {
  kind: string;
  title: string;
  description: string;
  owner: string;
  due: string;
  urgent: boolean;
};

function buildReviewQueue(
  companies: CompanyProposalSummary[],
  deliverables: DeliverableItem[]
): ReviewQueueItem[] {
  const companyItems = companies
    .filter((company) => company.pending + company.inReview + company.needsRevision > 0)
    .slice(0, 3)
    .map((company) => ({
      kind: company.needsRevision > 0 ? "보완요청" : "승인",
      title: `${company.companyName} 학생 제안 검토`,
      description: `대기 ${company.pending}건, 검토 ${company.inReview}건, 수정요청 ${company.needsRevision}건`,
      owner: `${company.companyName} → 소이랩 운영진`,
      due: company.lastSubmittedAt ?? "마감 미정",
      urgent: company.needsRevision > 0
    }));

  const deliverableItems = deliverables
    .filter((item) => item.status === "in_review" || item.status === "draft")
    .slice(0, 2)
    .map((item) => ({
      kind: item.status === "in_review" ? "승인" : "보완요청",
      title: item.title,
      description: `${item.format} 산출물 상태: ${statusLabel[item.status] ?? item.status}`,
      owner: "소이랩 PM → 발주기관",
      due: "12월 제출 전",
      urgent: item.status === "draft"
    }));

  return [...companyItems, ...deliverableItems].slice(0, 5);
}

function formatCurrency(value: number): string {
  if (!value) return "0원";
  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
}
