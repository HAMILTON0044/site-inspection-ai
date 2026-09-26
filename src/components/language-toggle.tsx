"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className="fixed right-3 top-3 z-[60] flex rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur sm:right-5"
      role="group"
      aria-label={
        locale === "zh"
          ? t("language.switchToEnglish")
          : t("language.switchToChinese")
      }
    >
      <button
        type="button"
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
          locale === "zh"
            ? "bg-slate-950 text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {t("language.zh")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
          locale === "en"
            ? "bg-slate-950 text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {t("language.en")}
      </button>
    </div>
  );
}
