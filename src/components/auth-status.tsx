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
    <aside className="fixed right-3 top-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur sm:right-5 sm:px-4">
      <div className="min-w-0 text-right">
        <p className="max-w-28 truncate text-xs font-semibold text-slate-900 sm:max-w-44 sm:text-sm">
          {displayName}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
          {roleLabel}
        </p>
      </div>
      <form action={signOut}>
        <button className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:px-3 sm:text-sm">
          退出
        </button>
      </form>
    </aside>
  );
}
