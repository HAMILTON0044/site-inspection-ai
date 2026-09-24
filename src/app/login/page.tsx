import { signIn, signUp } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(420px,0.9fr)_minmax(540px,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-[#0b1728] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14">
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
              <path d="M12 3 4.5 6v5.2c0 4.8 3.2 8.3 7.5 9.8 4.3-1.5 7.5-5 7.5-9.8V6L12 3Z" />
              <path d="m8.5 12 2.2 2.2 4.8-5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide">SITE INSPECTION</p>
            <p className="text-[11px] font-medium tracking-[0.2em] text-slate-400">AI OPERATIONS</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Safer sites. Clearer decisions.</p>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            让每一次现场巡检，
            <span className="text-amber-300">都有证据可追溯。</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
            从现场照片识别、AI 问题草拟到人工复核和云端归档，将分散的巡检信息汇聚成清晰的整改闭环。
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["本地识别", "照片无需发送给 LLM"],
              ["人工复核", "结论由巡检员确认"],
              ["团队协作", "正式记录统一归档"],
            ].map(([title, detail]) => (
              <div key={title} className="border-l border-white/20 pl-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-500">AI 辅助判断 · 最终安全结论须经人工确认</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-amber-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M12 3 4.5 6v5.2c0 4.8 3.2 8.3 7.5 9.8 4.3-1.5 7.5-5 7.5-9.8V6L12 3Z" />
                <path d="m8.5 12 2.2 2.2 4.8-5" />
              </svg>
            </div>
            <p className="text-sm font-bold tracking-wide text-slate-950">SITE INSPECTION AI</p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Secure workspace</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">欢迎回来</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            登录后继续巡检、审核问题并将正式记录提交到项目空间。
          </p>

          {error && (
            <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {message && (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </p>
          )}

          <form className="mt-8 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              姓名
              <input
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={100}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="注册时填写，登录时可留空"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              邮箱
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="inspector@example.com"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              密码
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="至少 8 个字符"
              />
            </label>

            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <button
                formAction={signIn}
                className="rounded-xl bg-slate-950 px-5 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                登录工作台
              </button>
              <button
                formAction={signUp}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3.5 font-semibold text-slate-800 shadow-sm transition hover:border-blue-400 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                注册巡检员
              </button>
            </div>
          </form>

          <div className="mt-7 flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">i</span>
            <p>新注册账号固定为巡检员。Manager 权限只能由项目管理员在受信任环境中授予。</p>
          </div>
        </div>
      </section>
    </main>
  );
}
