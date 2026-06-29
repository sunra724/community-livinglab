"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertAdminWriteAccess,
  getWritableSupabaseClient
} from "@/lib/admin-data";
import { currentUserCanOperateProject, getCurrentUserContext } from "@/lib/auth-context";

const projectSlug = "knu-2026";

export async function addParticipantAction(formData: FormData) {
  await runAdminAction(formData, async ({ supabase, projectId }) => {
    const type = requiredValue(formData, "type");
    const name = requiredValue(formData, "name");
    const email = optionalValue(formData, "email");
    const phone = optionalValue(formData, "phone");
    const organization = optionalValue(formData, "organization");
    const profileData = buildParticipantProfile(type, formData);

    const { error } = await supabase.from("participants").insert({
      project_id: projectId,
      type,
      name,
      email,
      phone,
      organization: organization || (type === "youth" ? "경북대학교" : name),
      profile_data: profileData,
      status: "active"
    });

    if (error) throw new Error(error.message);
  }, "참여자를 등록했습니다.");
}

export async function saveMatchingAction(formData: FormData) {
  await runAdminAction(formData, async ({ supabase, projectId }) => {
    const companyId = requiredValue(formData, "companyId");
    const youthIds = formData
      .getAll("youthIds")
      .map(String)
      .filter(Boolean);
    const notes = optionalValue(formData, "notes");

    if (youthIds.length === 0) {
      throw new Error("매칭할 청년을 1명 이상 선택해 주세요.");
    }

    const existing = await supabase
      .from("matchings")
      .select("id")
      .eq("project_id", projectId)
      .eq("company_id", companyId)
      .limit(1);

    if (existing.error) throw new Error(existing.error.message);

    const existingId = existing.data?.[0]?.id;
    const payload = {
      project_id: projectId,
      company_id: companyId,
      youth_ids: youthIds,
      notes
    };

    const result = existingId
      ? await supabase.from("matchings").update(payload).eq("id", existingId)
      : await supabase.from("matchings").insert(payload);

    if (result.error) throw new Error(result.error.message);
  }, "기업-청년 매칭을 저장했습니다.");
}

export async function updateDeliverableAction(formData: FormData) {
  await runAdminAction(formData, async ({ supabase }) => {
    const deliverableId = requiredValue(formData, "deliverableId");
    const status = requiredValue(formData, "status");
    const fileUrl = optionalValue(formData, "fileUrl");
    const fileFormat = optionalValue(formData, "fileFormat");
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("deliverables")
      .update({
        status,
        file_url: fileUrl,
        file_format: fileFormat,
        approved_at: status === "approved" ? now : null,
        submitted_at: status === "submitted" ? now : null
      })
      .eq("id", deliverableId);

    if (error) throw new Error(error.message);
  }, "성과품 상태를 변경했습니다.");
}

export async function reviewProposalAction(formData: FormData) {
  await runAdminAction(formData, async ({ supabase }) => {
    const proposalId = requiredValue(formData, "proposalId");
    const status = requiredValue(formData, "status");
    const feedback = optionalValue(formData, "feedback");
    const decision = optionalValue(formData, "decision");

    if (status === "rejected" && feedback.trim().length < 5) {
      throw new Error("거절할 때는 5자 이상의 피드백이 필요합니다.");
    }

    const { error } = await supabase
      .from("student_proposals")
      .update({
        status,
        company_feedback: feedback,
        company_decision: decision,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", proposalId);

    if (error) throw new Error(error.message);
  }, "학생 제안을 검토 처리했습니다.");
}

export async function updateBudgetAction(formData: FormData) {
  await runAdminAction(formData, async ({ supabase }) => {
    const userContext = await getCurrentUserContext();
    if (userContext.role !== "super_admin") {
      throw new Error("예산 관리는 슈퍼관리자만 사용할 수 있습니다.");
    }

    const budgetId = requiredValue(formData, "budgetId");
    const executedAmount = Number(requiredValue(formData, "executedAmount"));
    const executedAt = optionalValue(formData, "executedAt") || null;
    const payee = optionalValue(formData, "payee");
    const evidenceUrl = optionalValue(formData, "evidenceUrl");

    if (!Number.isFinite(executedAmount) || executedAmount < 0) {
      throw new Error("집행액은 0 이상의 숫자로 입력해 주세요.");
    }

    const { error } = await supabase
      .from("budget_items")
      .update({
        executed_amount: Math.round(executedAmount),
        executed_at: executedAt,
        payee,
        evidence_url: evidenceUrl
      })
      .eq("id", budgetId);

    if (error) throw new Error(error.message);
  }, "예산 집행 누계를 저장했습니다.");
}

async function runAdminAction(
  formData: FormData,
  task: (context: {
    supabase: ReturnType<typeof getWritableSupabaseClient>;
    projectId: string;
  }) => Promise<void>,
  successNotice: string
) {
  const code = optionalValue(formData, "adminCode");
  let notice = successNotice;
  let level: "success" | "error" = "success";

  try {
    const hasRoleAccess = await currentUserCanOperateProject();
    if (!hasRoleAccess) {
      assertAdminWriteAccess(code);
    }

    const supabase = getWritableSupabaseClient();
    const projectId = await getProjectId(supabase);

    await task({ supabase, projectId });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
  } catch (error) {
    notice = error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.";
    level = "error";
  }

  redirectToAdmin(code, notice, level);
}

async function getProjectId(supabase: ReturnType<typeof getWritableSupabaseClient>) {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", projectSlug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("knu-2026 프로젝트를 찾을 수 없습니다.");

  return String(data.id);
}

function buildParticipantProfile(type: string, formData: FormData) {
  if (type === "company") {
    return {
      representative: optionalValue(formData, "representative"),
      proposed_problem: optionalValue(formData, "problem"),
      proposed_solution: optionalValue(formData, "solution")
    };
  }

  if (type === "youth") {
    return {
      major: optionalValue(formData, "major"),
      grade: optionalValue(formData, "grade"),
      skills: optionalValue(formData, "skills")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    };
  }

  return {};
}

function redirectToAdmin(code: string, notice: string, level: "success" | "error") {
  const params = new URLSearchParams();
  if (code) params.set("key", code);
  params.set("notice", notice);
  params.set("level", level);
  redirect(`/admin?${params.toString()}`);
}

function requiredValue(formData: FormData, key: string): string {
  const value = optionalValue(formData, key);

  if (!value) {
    throw new Error(`${key} 값을 입력해 주세요.`);
  }

  return value;
}

function optionalValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
