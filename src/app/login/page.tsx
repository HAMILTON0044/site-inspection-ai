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
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          Site Inspection AI
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          登录巡检工作台
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          巡检员可以保存和跟进现场问题，Manager 可以查看团队项目与全部正式记录。
        </p>

        {error && (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        )}

        <form className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            姓名
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              maxLength={100}
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="至少 8 个字符"
            />
          </label>

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <button
              formAction={signIn}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              登录
            </button>
            <button
              formAction={signUp}
              className="rounded-xl border border-blue-600 px-5 py-3 font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              注册巡检员
            </button>
          </div>
        </form>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          新注册账号固定为巡检员。Manager 权限只能由项目管理员在受信任环境中授予。
        </p>
      </div>
    </main>
  );
}
