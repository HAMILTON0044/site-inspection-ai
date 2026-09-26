"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export default function LandingPage() {
  const { locale, t } = useLanguage();

  return (
    <main className="relative isolate grid min-h-svh grid-rows-[1fr_auto_1fr] overflow-hidden bg-[#0b1728] px-6 py-16 text-center text-white sm:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-48 top-1/4 -z-10 h-[36rem] w-[36rem] rounded-full bg-blue-500/10 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-48 bottom-0 -z-10 h-[36rem] w-[36rem] rounded-full bg-amber-400/10 blur-[100px]" />

      <header className="flex flex-col items-center justify-end pb-10 sm:pb-14">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 sm:h-16 sm:w-16">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8">
            <path d="M12 3 4.5 6v5.2c0 4.8 3.2 8.3 7.5 9.8 4.3-1.5 7.5-5 7.5-9.8V6L12 3Z" />
            <path d="m8.5 12 2.2 2.2 4.8-5" />
          </svg>
        </div>
        <h1 className="text-[clamp(2.25rem,7vw,6rem)] font-bold leading-none tracking-tight">SITE INSPECTION</h1>
        <p className="mt-4 text-sm font-medium tracking-[0.35em] text-slate-400 sm:text-lg sm:tracking-[0.5em]">AI OPERATIONS</p>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 sm:text-sm">{t("login.heroEyebrow")}</p>
      </header>

      <div className="flex justify-center">
        <Link href="/login" className="inline-flex min-h-16 min-w-56 items-center justify-center rounded-2xl bg-amber-400 px-12 py-4 text-xl font-bold text-slate-950 shadow-[0_8px_40px_-12px_rgba(251,191,36,0.45)] transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-amber-300 sm:min-w-64">
          {locale === "zh" ? "登录" : "Log in"}
        </Link>
      </div>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center pt-10 sm:pt-14">
        <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-3xl">
          {t("login.heroLine1")}{" "}<span className="text-amber-300">{t("login.heroLine2")}</span>
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">{t("login.heroDescription")}</p>
        <div className="mt-8 grid w-full grid-cols-3 gap-3 sm:gap-8">
          {[
            [t("login.feature.localTitle"), t("login.feature.localDetail")],
            [t("login.feature.reviewTitle"), t("login.feature.reviewDetail")],
            [t("login.feature.teamTitle"), t("login.feature.teamDetail")],
          ].map(([title, detail]) => (
            <div key={title}>
              <p className="text-xs font-semibold text-slate-200 sm:text-sm">{title}</p>
              <p className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block">{detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-auto pt-10 text-[11px] leading-5 text-slate-500">{t("login.disclaimer")}</p>
      </section>
    </main>
  );
}
