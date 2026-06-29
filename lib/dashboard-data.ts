import { createClient } from "@supabase/supabase-js";

export type ConnectionMode = "live" | "sample" | "error";

export type DashboardKpi = {
  key: string;
  label: string;
  value: string;
  detail: string;
  progress: number;
  tone: "green" | "blue" | "amber" | "rose" | "ink";
};

export type TimelineItem = {
  label: string;
  range: string;
  status: "done" | "active" | "next" | "planned";
};

export type WorkshopEvent = {
  sessionNo: number;
  title: string;
  date: string;
  location: string;
  status: string;
};

export type DeliverableItem = {
  type: string;
  title: string;
  status: string;
  format: string;
};

export type CompanyProposalSummary = {
  companyName: string;
  total: number;
  pending: number;
  inReview: number;
  needsRevision: number;
  accepted: number;
  rejected: number;
  lastSubmittedAt: string | null;
};

export type BudgetItem = {
  category: string;
  planned: number;
  executed: number;
};

export type Workstream = {
  name: string;
  owner: string;
  status: "ready" | "watch" | "blocked";
  note: string;
};

export type DashboardData = {
  connection: {
    mode: ConnectionMode;
    label: string;
    detail: string;
  };
  project: {
    name: string;
    client: string;
    period: string;
    budget: number;
  };
  kpis: DashboardKpi[];
  timeline: TimelineItem[];
  workshops: WorkshopEvent[];
  deliverables: DeliverableItem[];
  companies: CompanyProposalSummary[];
  budget: BudgetItem[];
  workstreams: Workstream[];
};

const fallbackData: DashboardData = {
  connection: {
    mode: "sample",
    label: "샘플 데이터",
    detail: "Supabase 연결 전"
  },
  project: {
    name: "2026 커뮤니티 리빙랩 프로젝트",
    client: "경북대학교 지역사회공헌센터",
    period: "2026.06.29 - 2026.12.31",
    budget: 40000000
  },
  kpis: [
    {
      key: "companies",
      label: "참여기업",
      value: "0 / 4",
      detail: "PT 심사 후 확정",
      progress: 0,
      tone: "green"
    },
    {
      key: "youths",
      label: "참여학생",
      value: "0 / 8",
      detail: "기업별 2명 매칭",
      progress: 0,
      tone: "blue"
    },
    {
      key: "citizens",
      label: "실증 참여자",
      value: "0 / 150",
      detail: "솔루션별 사용자 피드백",
      progress: 0,
      tone: "amber"
    },
    {
      key: "satisfaction",
      label: "만족도",
      value: "- / 4.5",
      detail: "기업·청년 각각 목표",
      progress: 0,
      tone: "rose"
    },
    {
      key: "deliverables",
      label: "성과품",
      value: "0 / 7",
      detail: "PDF 또는 HWPX 중심",
      progress: 0,
      tone: "ink"
    },
    {
      key: "budget",
      label: "예산 집행",
      value: "0%",
      detail: "40,000천원 기준",
      progress: 0,
      tone: "green"
    }
  ],
  timeline: [
    { label: "모집 공고", range: "06.29 - 07.10", status: "active" },
    { label: "PT·서면평가", range: "07.13 - 07.16", status: "next" },
    { label: "최종 선발 안내", range: "07.20 - 07.24", status: "planned" },
    { label: "문제발굴 워크숍", range: "07.27 - 08.31", status: "planned" },
    { label: "현장 실증", range: "09.01 - 10.31", status: "planned" },
    { label: "성과공유·정산", range: "12월", status: "planned" }
  ],
  workshops: [
    {
      sessionNo: 1,
      title: "오리엔테이션 및 팀빌딩",
      date: "2026.07.28 14:00",
      location: "경북대학교",
      status: "planned"
    },
    {
      sessionNo: 2,
      title: "문제정의 심화학습",
      date: "2026.08.04 14:00",
      location: "경북대학교",
      status: "planned"
    },
    {
      sessionNo: 3,
      title: "현장조사 실행",
      date: "2026.08.18 14:00",
      location: "현장",
      status: "planned"
    },
    {
      sessionNo: 4,
      title: "문제정의서 및 기능요구서",
      date: "2026.08.25 14:00",
      location: "경북대학교",
      status: "planned"
    }
  ],
  deliverables: [
    { type: "kickoff_plan", title: "착수계 / 운영계획서", status: "draft", format: "PDF/HWPX" },
    { type: "problem_definition", title: "문제정의서 및 기능요구서", status: "draft", format: "PDF/HWPX" },
    { type: "validation_plan", title: "실증계획서", status: "draft", format: "PDF/HWPX" },
    { type: "validation_report", title: "실증 결과보고서", status: "draft", format: "PDF/HWPX" },
    { type: "final_report", title: "최종 결과보고서", status: "draft", format: "PDF/HWPX" },
    { type: "activity_photos", title: "활동사진 및 증빙자료", status: "draft", format: "JPG/PDF" },
    { type: "settlement", title: "정산 관련 자료", status: "draft", format: "PDF" }
  ],
  companies: [
    {
      companyName: "선정 전",
      total: 0,
      pending: 0,
      inReview: 0,
      needsRevision: 0,
      accepted: 0,
      rejected: 0,
      lastSubmittedAt: null
    }
  ],
  budget: [
    { category: "인건비", planned: 3200000, executed: 0 },
    { category: "운영비", planned: 4000000, executed: 0 },
    { category: "실증비", planned: 20000000, executed: 0 },
    { category: "전문가", planned: 5000000, executed: 0 },
    { category: "성과공유회", planned: 3000000, executed: 0 },
    { category: "제작비", planned: 2000000, executed: 0 },
    { category: "예비비", planned: 2800000, executed: 0 }
  ],
  workstreams: [
    {
      name: "모집·선정",
      owner: "소이랩 운영진",
      status: "ready",
      note: "기업 4개사, 학생 8명 선정 흐름"
    },
    {
      name: "문제발굴",
      owner: "퍼실리테이터",
      status: "ready",
      note: "4회 워크숍과 문제정의 산출"
    },
    {
      name: "현장 실증",
      owner: "기업·청년 매칭팀",
      status: "watch",
      note: "최소 6주 테스트와 사용자 피드백"
    },
    {
      name: "성과관리",
      owner: "프로젝트 매니저",
      status: "ready",
      note: "정량·정성 지표와 결과보고"
    }
  ]
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return fallbackData;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    const [kpiResult, eventsResult, deliverablesResult, companiesResult, budgetResult] =
      await Promise.all([
        supabase.from("project_kpis").select("*").eq("slug", "knu-2026").maybeSingle(),
        supabase
          .from("events")
          .select("session_no,title,scheduled_at,location,status")
          .eq("phase", "problem_discovery")
          .order("session_no", { ascending: true }),
        supabase
          .from("deliverables")
          .select("type,title,status,file_format")
          .order("type", { ascending: true }),
        supabase.from("company_proposal_summary").select("*").order("company_name"),
        supabase
          .from("budget_items")
          .select("category,planned_amount,executed_amount")
          .order("category")
      ]);

    const firstError =
      kpiResult.error ??
      eventsResult.error ??
      deliverablesResult.error ??
      companiesResult.error ??
      budgetResult.error;

    if (firstError || !kpiResult.data) {
      return withConnection(fallbackData, {
        mode: "error",
        label: "연결 확인 필요",
        detail: firstError?.message ?? "KPI 데이터 없음"
      });
    }

    return buildLiveData({
      kpi: kpiResult.data,
      events: eventsResult.data ?? [],
      deliverables: deliverablesResult.data ?? [],
      companies: companiesResult.data ?? [],
      budget: budgetResult.data ?? []
    });
  } catch (error) {
    return withConnection(fallbackData, {
      mode: "error",
      label: "연결 확인 필요",
      detail: error instanceof Error ? error.message : "Supabase 조회 실패"
    });
  }
}

function buildLiveData(payload: {
  kpi: Record<string, unknown>;
  events: Record<string, unknown>[];
  deliverables: Record<string, unknown>[];
  companies: Record<string, unknown>[];
  budget: Record<string, unknown>[];
}): DashboardData {
  const kpi = payload.kpi;
  const targetCompanies = toNumber(kpi.target_companies);
  const targetYouths = toNumber(kpi.target_youths);
  const targetCitizens = toNumber(kpi.target_citizens);
  const currentCompanies = toNumber(kpi.current_companies);
  const currentYouths = toNumber(kpi.current_youths);
  const currentCitizens = toNumber(kpi.current_citizens);
  const targetSatisfaction = toNumber(kpi.target_satisfaction);
  const avgSatisfaction = nullableNumber(kpi.avg_satisfaction);
  const deliverablesDone = toNumber(kpi.deliverables_done);
  const deliverablesTotal = toNumber(kpi.deliverables_total);
  const budgetPlanned = toNumber(kpi.budget_planned);
  const budgetExecuted = toNumber(kpi.budget_executed);

  return {
    ...fallbackData,
    connection: {
      mode: "live",
      label: "Supabase 연결",
      detail: "project_kpis 기준"
    },
    project: {
      name: String(kpi.name ?? fallbackData.project.name),
      client: fallbackData.project.client,
      period: `${formatShortDate(kpi.period_start)} - ${formatShortDate(kpi.period_end)}`,
      budget: budgetPlanned || fallbackData.project.budget
    },
    kpis: [
      metric("companies", "참여기업", currentCompanies, targetCompanies, "PT 심사 후 확정", "green"),
      metric("youths", "참여학생", currentYouths, targetYouths, "기업별 2명 매칭", "blue"),
      metric("citizens", "실증 참여자", currentCitizens, targetCitizens, "사용자 피드백", "amber"),
      {
        key: "satisfaction",
        label: "만족도",
        value: `${avgSatisfaction?.toFixed(1) ?? "-"} / ${targetSatisfaction.toFixed(1)}`,
        detail: "기업·청년 각각 목표",
        progress: avgSatisfaction ? clamp((avgSatisfaction / targetSatisfaction) * 100) : 0,
        tone: "rose"
      },
      metric("deliverables", "성과품", deliverablesDone, deliverablesTotal, "승인·제출 기준", "ink"),
      {
        key: "budget",
        label: "예산 집행",
        value: `${Math.round(safeRatio(budgetExecuted, budgetPlanned) * 100)}%`,
        detail: `${formatWon(budgetExecuted)} / ${formatWon(budgetPlanned)}`,
        progress: clamp(safeRatio(budgetExecuted, budgetPlanned) * 100),
        tone: "green"
      }
    ],
    workshops: payload.events.length
      ? payload.events.map((event) => ({
          sessionNo: toNumber(event.session_no),
          title: String(event.title ?? ""),
          date: formatDateTime(event.scheduled_at),
          location: String(event.location ?? "-"),
          status: String(event.status ?? "planned")
        }))
      : fallbackData.workshops,
    deliverables: payload.deliverables.length
      ? payload.deliverables.map((item) => ({
          type: String(item.type ?? ""),
          title: String(item.title ?? ""),
          status: String(item.status ?? "draft"),
          format: String(item.file_format ?? "PDF/HWPX")
        }))
      : fallbackData.deliverables,
    companies: payload.companies.length
      ? payload.companies.map((company) => ({
          companyName: String(company.company_name ?? ""),
          total: toNumber(company.total_proposals),
          pending: toNumber(company.pending_review),
          inReview: toNumber(company.in_review),
          needsRevision: toNumber(company.needs_revision),
          accepted: toNumber(company.accepted),
          rejected: toNumber(company.rejected),
          lastSubmittedAt: company.last_submitted_at
            ? formatDateTime(company.last_submitted_at)
            : null
        }))
      : fallbackData.companies,
    budget: payload.budget.length
      ? payload.budget.map((item) => ({
          category: String(item.category ?? ""),
          planned: toNumber(item.planned_amount),
          executed: toNumber(item.executed_amount)
        }))
      : fallbackData.budget
  };
}

function withConnection(
  data: DashboardData,
  connection: DashboardData["connection"]
): DashboardData {
  return { ...data, connection };
}

function metric(
  key: string,
  label: string,
  current: number,
  target: number,
  detail: string,
  tone: DashboardKpi["tone"]
): DashboardKpi {
  return {
    key,
    label,
    value: `${current} / ${target}`,
    detail,
    progress: clamp(safeRatio(current, target) * 100),
    tone
  };
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function safeRatio(current: number, target: number): number {
  return target > 0 ? current / target : 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatWon(value: number): string {
  if (!value) return "0원";
  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
}

function formatShortDate(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
