import { signIn, signUp } from "./actions";
import { getTranslator } from "@/lib/i18n-server";
import { translateKnownValue } from "@/lib/i18n";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;
  const { locale, t } = await getTranslator();

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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">{t("login.heroEyebrow")}</p>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            <span className="block">{t("login.heroLine1")}</span>
            <span className="block text-amber-300">{t("login.heroLine2")}</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
            {t("login.heroDescription")}
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              [t("login.feature.localTitle"), t("login.feature.localDetail")],
              [t("login.feature.reviewTitle"), t("login.feature.reviewDetail")],
              [t("login.feature.teamTitle"), t("login.feature.teamDetail")],
            ].map(([title, detail]) => (
              <div key={title} className="border-l border-white/20 pl-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-500">{t("login.disclaimer")}</p>
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

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{t("login.eyebrow")}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t("login.title")}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t("login.subtitle")}
          </p>

          {error && (
            <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {translateKnownValue(locale, error)}
            </p>
          )}

          {message && (
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {translateKnownValue(locale, message)}
            </p>
          )}

          <form className="mt-8 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              {t("login.name")}
              <input
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={100}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder={t("login.namePlaceholder")}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              {t("login.email")}
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
              {t("login.password")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder={t("login.passwordPlaceholder")}
              />
            </label>

            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <button
                formAction={signIn}
                className="rounded-xl bg-slate-950 px-5 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                {t("login.signIn")}
              </button>
              <button
                formAction={signUp}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3.5 font-semibold text-slate-800 shadow-sm transition hover:border-blue-400 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                {t("login.signUp")}
              </button>
            </div>
          </form>

          <div className="mt-7 flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">i</span>
            <p>{t("login.roleNotice")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
