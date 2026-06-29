import {
  Activity,
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  MessageSquareText,
  Network,
  ShieldCheck,
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

const kpiIcons: Record<string, typeof Building2> = {
  companies: Building2,
  youths: UsersRound,
  citizens: Network,
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
  next: "다음",
  planned: "예정"
};

const workstreamLabel: Record<Workstream["status"], string> = {
  ready: "정상",
  watch: "관찰",
  blocked: "막힘"
};

export function LivingLabDashboard({ data }: { data: DashboardData }) {
  const totalPlanned = data.budget.reduce((sum, item) => sum + item.planned, 0);
  const totalExecuted = data.budget.reduce((sum, item) => sum + item.executed, 0);
  const budgetProgress = totalPlanned ? (totalExecuted / totalPlanned) * 100 : 0;

  return (
    <div className="console-shell">
      <header className="console-header">
        <div className="console-header-inner">
          <a className="console-brand" href="#overview" aria-label="커뮤니티 리빙랩 운영콘솔">
            <span className="brand-symbol">
              <Landmark size={18} strokeWidth={2.2} />
            </span>
            <span>
              <strong>Community Living Lab</strong>
              <small>운영콘솔</small>
            </span>
          </a>

          <nav className="console-nav" aria-label="대시보드 탐색">
            <a href="#overview">
              <LayoutDashboard size={16} />
              개요
            </a>
            <a href="#timeline">
              <CalendarDays size={16} />
              일정
            </a>
            <a href="#workshops">
              <ClipboardList size={16} />
              워크숍
            </a>
            <a href="#deliverables">
              <FileText size={16} />
              성과품
            </a>
            <a href="#proposals">
              <MessageSquareText size={16} />
              제안
            </a>
          </nav>

          <div className={`connection-pill ${data.connection.mode}`}>
            <Database size={15} />
            <span>{data.connection.label}</span>
          </div>
        </div>
      </header>

      <main className="console-main">
        <section className="console-intro" id="overview">
          <div className="intro-copy">
            <p className="eyebrow">SOILAB × COMMUNITY & ECONOMY</p>
            <h1>{data.project.name}</h1>
            <p>
              참여기업, 청년 매칭, 현장 실증, 성과품 제출까지 한 화면에서 확인하는
              운영 관리 대시보드입니다.
            </p>
            <div className="project-meta">
              <span>{data.project.client}</span>
              <span>{data.project.period}</span>
              <span>{formatCurrency(data.project.budget)}</span>
            </div>
          </div>

          <div className="intro-card">
            <div className="intro-card-top">
              <ShieldCheck size={18} />
              <strong>권한 기준</strong>
            </div>
            <dl>
              <div>
                <dt>관리자</dt>
                <dd>전체 KPI·예산·신청·성과관리</dd>
              </div>
              <div>
                <dt>참여기업</dt>
                <dd>자기 회사 실증·제안·피드백</dd>
              </div>
              <div>
                <dt>청년</dt>
                <dd>본인 제안과 매칭 회사 정보</dd>
              </div>
            </dl>
            <p className="connection-note">{data.connection.detail}</p>
          </div>
        </section>

        <section className="kpi-grid" aria-label="핵심 지표">
          {data.kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </section>

        <section className="dashboard-grid two-columns">
          <div className="panel" id="timeline">
            <PanelHeading icon={CalendarDays} title="추진 일정" aside="2026" />
            <div className="timeline-list">
              {data.timeline.map((item) => (
                <TimelineRow key={item.label} item={item} />
              ))}
            </div>
          </div>

          <div className="panel">
            <PanelHeading icon={ShieldCheck} title="운영 흐름" aside="RLS 기준" />
            <div className="workstream-list">
              {data.workstreams.map((item) => (
                <WorkstreamRow key={item.name} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-grid main-columns">
          <div className="panel table-panel" id="workshops">
            <PanelHeading icon={ClipboardList} title="문제발굴 워크숍" aside="4회차" />
            <WorkshopTable events={data.workshops} />
          </div>

          <div className="panel">
            <PanelHeading icon={WalletCards} title="예산 집행" aside={`${Math.round(budgetProgress)}%`} />
            <div className="budget-total">
              <strong>{formatCurrency(totalExecuted)}</strong>
              <span>{formatCurrency(totalPlanned)}</span>
            </div>
            <div className="budget-list">
              {data.budget.map((item) => (
                <BudgetRow key={item.category} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-grid main-columns">
          <div className="panel" id="deliverables">
            <PanelHeading icon={FileText} title="성과품" aside={`${data.deliverables.length}종`} />
            <div className="deliverable-list">
              {data.deliverables.map((item) => (
                <DeliverableRow key={`${item.type}-${item.title}`} item={item} />
              ))}
            </div>
          </div>

          <div className="panel" id="proposals">
            <PanelHeading icon={MessageSquareText} title="기업별 제안 검토" aside="학생 제안" />
            <div className="proposal-list">
              {data.companies.map((company) => (
                <ProposalRow key={company.companyName} company={company} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="console-footer">
        <div>
          <span>협동조합 소이랩 × 커뮤니티와경제</span>
          <span>community-livinglab.soilabcoop.kr</span>
        </div>
      </footer>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: DashboardKpi }) {
  const Icon = kpiIcons[kpi.key] ?? Activity;

  return (
    <article className={`kpi-card tone-${kpi.tone}`}>
      <div className="kpi-card-header">
        <div className="metric-icon">
          <Icon size={18} />
        </div>
        <span>{kpi.label}</span>
      </div>
      <strong>{kpi.value}</strong>
      <div className="progress-track" aria-label={`${kpi.label} 진행률 ${Math.round(kpi.progress)}%`}>
        <span style={{ width: `${kpi.progress}%` }} />
      </div>
      <p>{kpi.detail}</p>
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
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      <span>{aside}</span>
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  return (
    <div className={`timeline-row ${item.status}`}>
      <span className="timeline-marker" />
      <div>
        <strong>{item.label}</strong>
        <span>{item.range}</span>
      </div>
      <em>{timelineLabel[item.status]}</em>
    </div>
  );
}

function WorkstreamRow({ item }: { item: Workstream }) {
  const Icon = item.status === "ready" ? CheckCircle2 : AlertCircle;

  return (
    <div className={`workstream-row ${item.status}`}>
      <Icon size={18} />
      <div>
        <div className="row-title">
          <strong>{item.name}</strong>
          <span>{workstreamLabel[item.status]}</span>
        </div>
        <p>{item.owner}</p>
        <small>{item.note}</small>
      </div>
    </div>
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
        <FileText size={17} />
      </div>
      <div>
        <strong>{item.title}</strong>
        <span>{item.format}</span>
      </div>
      <em className={`status-pill ${item.status}`}>{statusLabel[item.status] ?? item.status}</em>
    </div>
  );
}

function ProposalRow({ company }: { company: CompanyProposalSummary }) {
  return (
    <div className="proposal-row">
      <div className="proposal-topline">
        <strong>{company.companyName}</strong>
        <span>{company.total}건</span>
      </div>
      <div className="proposal-stats">
        <Stat label="대기" value={company.pending} />
        <Stat label="검토" value={company.inReview} />
        <Stat label="수정" value={company.needsRevision} />
        <Stat label="수용" value={company.accepted} />
        <Stat label="거절" value={company.rejected} />
      </div>
      <small>{company.lastSubmittedAt ?? "제출 이력 없음"}</small>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label}
      <strong>{value}</strong>
    </span>
  );
}

function formatCurrency(value: number): string {
  if (!value) return "0원";
  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
}
