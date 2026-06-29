"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/login/actions";

export { signOutAction };

export async function createYouthProposalAction(formData: FormData) {
  let notice = "제안을 제출했습니다.";
  let level: "success" | "error" = "success";

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) throw new Error("로그인이 필요합니다.");

    const companyId = requiredValue(formData, "companyId");
    const title = requiredValue(formData, "title");
    const category = optionalValue(formData, "category");
    const content = requiredValue(formData, "content");

    const youthResult = await supabase
      .from("participants")
      .select("id,project_id")
      .eq("user_id", user.id)
      .eq("type", "youth")
      .limit(1)
      .maybeSingle();

    if (youthResult.error) throw new Error(youthResult.error.message);
    if (!youthResult.data) throw new Error("청년 참여자 매핑이 없습니다.");

    const { error } = await supabase.from("student_proposals").insert({
      project_id: youthResult.data.project_id,
      company_id: companyId,
      author_id: youthResult.data.id,
      title,
      content,
      category,
      status: "submitted"
    });

    if (error) throw new Error(error.message);
  } catch (error) {
    notice = error instanceof Error ? error.message : "제안 제출 중 오류가 발생했습니다.";
    level = "error";
  }

  revalidatePath("/portal");
  redirect(`/portal?level=${level}&message=${encodeURIComponent(notice)}`);
}

export async function companyReviewProposalAction(formData: FormData) {
  let notice = "제안 검토를 저장했습니다.";
  let level: "success" | "error" = "success";

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) throw new Error("로그인이 필요합니다.");

    const proposalId = requiredValue(formData, "proposalId");
    const status = requiredValue(formData, "status");
    const feedback = optionalValue(formData, "feedback");
    const decision = optionalValue(formData, "decision");

    if (status === "rejected" && feedback.length < 5) {
      throw new Error("거절할 때는 5자 이상의 피드백이 필요합니다.");
    }

    const { error } = await supabase
      .from("student_proposals")
      .update({
        status,
        company_feedback: feedback,
        company_decision: decision
      })
      .eq("id", proposalId);

    if (error) throw new Error(error.message);
  } catch (error) {
    notice = error instanceof Error ? error.message : "제안 검토 저장 중 오류가 발생했습니다.";
    level = "error";
  }

  revalidatePath("/portal");
  revalidatePath("/dashboard");
  redirect(`/portal?level=${level}&message=${encodeURIComponent(notice)}`);
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
