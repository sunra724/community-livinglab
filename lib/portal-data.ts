import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PortalParticipant = {
  id: string;
  type: string;
  name: string;
  email: string | null;
  organization: string | null;
};

export type PortalMatching = {
  id: string;
  companyId: string;
  youthIds: string[];
  notes: string | null;
};

export type PortalProposal = {
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

export type PortalDeliverable = {
  id: string;
  title: string;
  status: string;
};

export type PortalData = {
  project: {
    name: string;
  };
  participants: PortalParticipant[];
  matchings: PortalMatching[];
  proposals: PortalProposal[];
  deliverables: PortalDeliverable[];
};

export async function getPortalData(): Promise<PortalData> {
  let supabase;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return fallbackPortalData();
  }

  const [projectResult, participantsResult, matchingsResult, proposalsResult, deliverablesResult] =
    await Promise.all([
      supabase.from("projects").select("name").eq("slug", "knu-2026").maybeSingle(),
      supabase
        .from("participants")
        .select("id,type,name,email,organization")
        .order("type")
        .order("name"),
      supabase.from("matchings").select("id,company_id,youth_ids,notes"),
      supabase
        .from("student_proposals")
        .select(
          "id,title,content,category,status,company_feedback,company_decision,submitted_at,company:participants!student_proposals_company_id_fkey(name),author:participants!student_proposals_author_id_fkey(name)"
        )
        .order("submitted_at", { ascending: false, nullsFirst: false }),
      supabase.from("deliverables").select("id,title,status").order("type")
    ]);

  return {
    project: {
      name: String(projectResult.data?.name ?? "2026 커뮤니티 리빙랩 프로젝트")
    },
    participants: (participantsResult.data ?? []).map((item) => ({
      id: String(item.id),
      type: String(item.type),
      name: String(item.name ?? ""),
      email: item.email ? String(item.email) : null,
      organization: item.organization ? String(item.organization) : null
    })),
    matchings: (matchingsResult.data ?? []).map((item) => ({
      id: String(item.id),
      companyId: String(item.company_id),
      youthIds: Array.isArray(item.youth_ids) ? item.youth_ids.map(String) : [],
      notes: item.notes ? String(item.notes) : null
    })),
    proposals: (proposalsResult.data ?? []).map((item) => ({
      id: String(item.id),
      title: String(item.title ?? ""),
      content: String(item.content ?? ""),
      category: item.category ? String(item.category) : null,
      status: String(item.status ?? "draft"),
      companyFeedback: item.company_feedback ? String(item.company_feedback) : null,
      companyDecision: item.company_decision ? String(item.company_decision) : null,
      submittedAt: item.submitted_at ? String(item.submitted_at) : null,
      companyName: String(relationName(item.company) ?? "기업 미지정"),
      authorName: String(relationName(item.author) ?? "작성자 미지정")
    })),
    deliverables: (deliverablesResult.data ?? []).map((item) => ({
      id: String(item.id),
      title: String(item.title ?? ""),
      status: String(item.status ?? "draft")
    }))
  };
}

function relationName(value: unknown) {
  if (Array.isArray(value)) {
    return isObject(value[0]) ? value[0].name : null;
  }

  return isObject(value) ? value.name : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function fallbackPortalData(): PortalData {
  return {
    project: {
      name: "2026 커뮤니티 리빙랩 프로젝트"
    },
    participants: [],
    matchings: [],
    proposals: [],
    deliverables: []
  };
}
