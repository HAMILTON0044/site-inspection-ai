import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export async function AuthStatus() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  const displayName =
    profile?.display_name ||
    (typeof claims.email === "string" ? claims.email : "当前用户");
  const roleLabel = profile?.role === "MANAGER" ? "Manager" : "巡检员";

  return (
    <aside className="fixed right-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur">
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-semibold text-slate-800">
          {displayName}
        </p>
        <p className="text-xs text-slate-500">{roleLabel}</p>
      </div>
      <form action={signOut}>
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          退出
        </button>
      </form>
    </aside>
  );
}
