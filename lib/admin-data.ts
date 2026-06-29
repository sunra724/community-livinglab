import { createClient } from "@supabase/supabase-js";

export type AdminParticipant = {
  id: string;
  type: "company" | "youth" | "citizen" | "expert";
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  profileData: Record<string, unknown>;
  status: string;
};

export type AdminMatching = {
  id: string;
  companyId: string;
  youthIds: string[];
  notes: string | null;
};

export type AdminDeliverable = {
  id: string;
  title: string;
  type: string;
  status: string;
  fileFormat: string | null;
  fileUrl: string | null;
  updatedAt: string | null;
};

export type AdminBudgetItem = {
  id: string;
  category: string;
  description: string | null;
  plannedAmount: number;
  executedAmount: number;
  executedAt: string | null;
  payee: string | null;
  evidenceUrl: string | null;
};

export type AdminProposal = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  status: string;
  companyFeedback: string | null;
  companyDecision: string | null;
  submittedAt: string | null;
  companyName: string;
  authorName: string;
};

export type AdminEvent = {
  id: string;
  sessionNo: number | null;
  title: string;
  scheduledAt: string;
  location: string | null;
  status: string;
};

export type AdminData = {
  connection: {
    mode: "live" | "sample" | "error";
    label: string;
    detail: string;
  };
  project: {
    id: string | null;
    name: string;
    slug: string;
  };
  participants: AdminParticipant[];
  matchings: AdminMatching[];
  deliverables: AdminDeliverable[];
  budget: AdminBudgetItem[];
  proposals: AdminProposal[];
  events: AdminEvent[];
};

const projectSlug = "knu-2026";

const fallbackAdminData: AdminData = {
  connection: {
    mode: "sample",
    label: "샘플 보기",
    detail: "Supabase 연결 정보가 없거나 초기 마이그레이션 전입니다."
  },
  project: {
    id: null,
    name: "2026 커뮤니티 리빙랩 프로젝트",
    slug: projectSlug
  },
  participants: [],
  matchings: [],
  deliverables: [],
  budget: [],
  proposals: [],
  events: []
};

export const deliverableStatusOptions = [
  { value: "draft", label: "작성전" },
  { value: "ai_generated", label: "AI 생성" },
  { value: "in_review", label: "검토중" },
  { value: "approved", label: "승인" },
  { value: "submitted", label: "제출" }
];

export const proposalReviewOptions = [
  { value: "under_review", label: "검토중" },
  { value: "accepted", label: "수용" },
  { value: "needs_revision", label: "수정요청" },
  { value: "rejected", label: "거절" }
];

export function getAdminAccess(searchKey?: string | string[]) {
  const configuredCode = process.env.ADMIN_ACCESS_CODE?.trim();
  const providedKey = Array.isArray(searchKey) ? searchKey[0] : searchKey;

  if (!configuredCode && process.env.NODE_ENV !== "production") {
    return {
      authorized: true,
      code: "",
      needsCode: false,
      message: "개발 환경이라 관리자 코드 없이 쓰기 기능을 열었습니다."
    };
  }

  return {
    authorized: Boolean(configuredCode && providedKey === configuredCode),
    code: providedKey ?? "",
    needsCode: Boolean(configuredCode),
    message: configuredCode
      ? "관리자 코드가 맞아야 쓰기 기능을 사용할 수 있습니다."
      : "Vercel 운영환경에서는 ADMIN_ACCESS_CODE를 먼저 설정해 주세요."
  };
}

export async function getAdminData(): Promise<AdminData> {
  const supabase = getReadableSupabaseClient();

  if (!supabase) {
    return fallbackAdminData;
  }

  try {
    const projectResult = await supabase
      .from("projects")
      .select("id,name,slug")
      .eq("slug", projectSlug)
      .maybeSingle();

    if (projectResult.error || !projectResult.data) {
      return withAdminConnection(fallbackAdminData, {
        mode: "error",
        label: "프로젝트 확인 필요",
        detail: projectResult.error?.message ?? "knu-2026 프로젝트가 없습니다."
      });
    }

    const projectId = String(projectResult.data.id);

    const [
      participantsResult,
      matchingsResult,
      deliverablesResult,
      budgetResult,
      proposalsResult,
      eventsResult
    ] = await Promise.all([
      supabase
        .from("participants")
        .select("id,type,name,email,phone,organization,profile_data,status")
        .eq("project_id", projectId)
        .order("type")
        .order("name"),
      supabase
        .from("matchings")
        .select("id,company_id,youth_ids,notes")
        .eq("project_id", projectId),
      supabase
        .from("deliverables")
        .select("id,title,type,status,file_format,file_url,updated_at")
        .eq("project_id", projectId)
        .is("company_id", null)
        .order("type"),
      supabase
        .from("budget_items")
        .select("id,category,description,planned_amount,executed_amount,executed_at,payee,evidence_url")
        .eq("project_id", projectId)
        .order("category"),
      supabase
        .from("student_proposals")
        .select(
          "id,title,content,category,status,company_feedback,company_decision,submitted_at,company:participants!student_proposals_company_id_fkey(name),author:participants!student_proposals_author_id_fkey(name)"
        )
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("events")
        .select("id,session_no,title,scheduled_at,location,status")
        .eq("project_id", projectId)
        .order("scheduled_at", { ascending: true })
    ]);

    const firstError =
      participantsResult.error ??
      matchingsResult.error ??
      deliverablesResult.error ??
      budgetResult.error ??
      proposalsResult.error ??
      eventsResult.error;

    if (firstError) {
      return withAdminConnection(fallbackAdminData, {
        mode: "error",
        label: "운영 데이터 확인 필요",
        detail: firstError.message
      });
    }

    return {
      connection: {
        mode: "live",
        label: "Supabase 연결",
        detail: "운영 입력 가능"
      },
      project: {
        id: projectId,
        name: String(projectResult.data.name),
        slug: String(projectResult.data.slug)
      },
      participants: (participantsResult.data ?? []).map(toParticipant),
      matchings: (matchingsResult.data ?? []).map(toMatching),
      deliverables: (deliverablesResult.data ?? []).map(toDeliverable),
      budget: (budgetResult.data ?? []).map(toBudgetItem),
      proposals: (proposalsResult.data ?? []).map(toProposal),
      events: (eventsResult.data ?? []).map(toEvent)
    };
  } catch (error) {
    return withAdminConnection(fallbackAdminData, {
      mode: "error",
      label: "운영 데이터 확인 필요",
      detail: error instanceof Error ? error.message : "Supabase 조회 실패"
    });
  }
}

export function getWritableSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

export function assertAdminWriteAccess(code: string) {
  const configuredCode = process.env.ADMIN_ACCESS_CODE?.trim();

  if (!configuredCode && process.env.NODE_ENV !== "production") {
    return;
  }

  if (!configuredCode) {
    throw new Error("운영환경 쓰기 보호를 위해 ADMIN_ACCESS_CODE를 설정해야 합니다.");
  }

  if (code !== configuredCode) {
    throw new Error("관리자 코드가 맞지 않습니다.");
  }
}

function getReadableSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

function withAdminConnection(
  data: AdminData,
  connection: AdminData["connection"]
): AdminData {
  return { ...data, connection };
}

function toParticipant(row: Record<string, unknown>): AdminParticipant {
  return {
    id: String(row.id),
    type: String(row.type) as AdminParticipant["type"],
    name: String(row.name ?? ""),
    email: nullableString(row.email),
    phone: nullableString(row.phone),
    organization: nullableString(row.organization),
    profileData: isObject(row.profile_data) ? row.profile_data : {},
    status: String(row.status ?? "active")
  };
}

function toMatching(row: Record<string, unknown>): AdminMatching {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    youthIds: Array.isArray(row.youth_ids) ? row.youth_ids.map(String) : [],
    notes: nullableString(row.notes)
  };
}

function toDeliverable(row: Record<string, unknown>): AdminDeliverable {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    type: String(row.type ?? ""),
    status: String(row.status ?? "draft"),
    fileFormat: nullableString(row.file_format),
    fileUrl: nullableString(row.file_url),
    updatedAt: nullableString(row.updated_at)
  };
}

function toBudgetItem(row: Record<string, unknown>): AdminBudgetItem {
  return {
    id: String(row.id),
    category: String(row.category ?? ""),
    description: nullableString(row.description),
    plannedAmount: toNumber(row.planned_amount),
    executedAmount: toNumber(row.executed_amount),
    executedAt: nullableString(row.executed_at),
    payee: nullableString(row.payee),
    evidenceUrl: nullableString(row.evidence_url)
  };
}

function toProposal(row: Record<string, unknown>): AdminProposal {
  const company = relationObject(row.company);
  const author = relationObject(row.author);

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    category: nullableString(row.category),
    status: String(row.status ?? "draft"),
    companyFeedback: nullableString(row.company_feedback),
    companyDecision: nullableString(row.company_decision),
    submittedAt: nullableString(row.submitted_at),
    companyName: String(company?.name ?? "기업 미지정"),
    authorName: String(author?.name ?? "작성자 미지정")
  };
}

function toEvent(row: Record<string, unknown>): AdminEvent {
  return {
    id: String(row.id),
    sessionNo: nullableNumber(row.session_no),
    title: String(row.title ?? ""),
    scheduledAt: String(row.scheduled_at ?? ""),
    location: nullableString(row.location),
    status: String(row.status ?? "planned")
  };
}

function relationObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return isObject(value[0]) ? value[0] : null;
  }

  return isObject(value) ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return toNumber(value);
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
