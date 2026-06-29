import { redirect } from "next/navigation";
import { Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { signInAction } from "@/app/login/actions";
import { getCurrentUserContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getCurrentUserContext();

  if (context.isAuthenticated) {
    redirect("/portal");
  }

  const params = (await searchParams) ?? {};
  const message = getParam(params.message);
  const level = getParam(params.level) === "error" ? "error" : "success";

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-brand">
          <span>
            <Landmark size={24} />
          </span>
          <div>
            <p>SOILAB</p>
            <h1>커뮤니티 리빙랩 로그인</h1>
          </div>
        </div>

        <p className="login-copy">
          운영진, 참여기업, 청년 참여자가 각자 맡은 일과 데이터만 확인하도록 로그인 기반 포털로
          연결합니다.
        </p>

        {message ? <div className={`login-message ${level}`}>{message}</div> : null}

        <form action={signInAction} className="login-form">
          <label>
            이메일
            <input name="email" type="email" autoComplete="email" required placeholder="name@example.com" />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Supabase Auth 비밀번호"
            />
          </label>
          <button type="submit">
            <LockKeyhole size={17} />
            로그인
          </button>
        </form>

        <div className="login-note">
          <ShieldCheck size={16} />
          <span>계정은 Supabase Authentication에서 생성하고, 권한은 SQL의 역할 매핑을 따릅니다.</span>
        </div>
      </section>
    </main>
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
