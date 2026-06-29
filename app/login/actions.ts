"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`/login?level=error&message=${encodeURIComponent("이메일과 비밀번호를 입력해 주세요.")}`);
  }

  let errorMessage = "";

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorMessage = error.message;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "로그인 중 오류가 발생했습니다.";
  }

  if (errorMessage) {
    redirect(`/login?level=error&message=${encodeURIComponent(errorMessage)}`);
  }

  redirect("/portal");
}

export async function signOutAction() {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore missing env/session during sign-out.
  }

  redirect("/login");
}
