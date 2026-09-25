import Link from "next/link";
import type { ReactNode } from "react";

type ProductShellProps = {
  children: ReactNode;
  activeItem?: "new" | "records" | "findings" | "projects";
  pageLabel?: string;
  title?: string;
};

type IconName =
  | "dashboard"
  | "inspection"
  | "finding"
  | "report"
  | "team"
  | "settings"
  | "shield";

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  inspection: (
    <>
      <path d="M9 5h6" />
      <path d="M9 9h6" />
      <path d="M9 13h4" />
      <path d="M5 3h14v18H5z" />
      <path d="m14 17 2 2 4-4" />
    </>
  ),
  finding: (
    <>
      <path d="M12 3 2.8 19h18.4L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  report: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6" />
      <path d="M16 4.5a3 3 0 0 1 0 5.5" />
      <path d="M17 14c2.6.5 4 2.4 4 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.2c0 4.8 3.2 8.3 7.5 9.8 4.3-1.5 7.5-5 7.5-9.8V6L12 3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </>
  ),
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      {iconPaths[name]}
    </svg>
  );
}

function navigationClass(active: boolean) {
  return active
    ? "flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white ring-1 ring-white/10"
    : "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white";
}

export function ProductShell({
  children,
  activeItem = "new",
  pageLabel = "新建巡检",
  title = "AI 现场安全巡检工作台",
}: ProductShellProps) {
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-[#0b1728] text-slate-200 lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.18)]">
            <Icon name="shield" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide text-white">
              SITE INSPECTION
            </p>
            <p className="text-[11px] font-medium tracking-[0.2em] text-slate-400">
              AI OPERATIONS
            </p>
          </div>
        </div>

        <nav aria-label="主导航" className="flex-1 px-4 py-6">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            工作台
          </p>
          <div className="mt-3 space-y-1">
            <Link href="/" className={navigationClass(activeItem === "new")}>
              <Icon name="inspection" />
              新建智能巡检
              {activeItem === "new" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" />
              )}
            </Link>
            <Link
              href="/inspections"
              className={navigationClass(activeItem === "records")}
            >
              <Icon name="dashboard" />
              巡检记录
              {activeItem === "records" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" />
              )}
            </Link>
          </div>

          <p className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            管理
          </p>
          <div className="mt-3 space-y-1">
            <Link
              href="/findings"
              className={navigationClass(activeItem === "findings")}
            >
              <Icon name="finding" />
              问题看板
              {activeItem === "findings" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" />
              )}
            </Link>
            <Link
              href="/projects"
              className={navigationClass(activeItem === "projects")}
            >
              <Icon name="team" />
              团队与项目
              {activeItem === "projects" && (
                <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" />
              )}
            </Link>
            <div
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500"
              title="后续版本开放"
            >
              <Icon name="report" />
              报告中心
              <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                即将推出
              </span>
            </div>
          </div>
        </nav>

        <div className="m-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            系统运行正常
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            本地视觉识别与云端记录服务已连接。
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-[76px] items-center border-b border-slate-200 bg-white/95 px-4 pr-52 backdrop-blur sm:px-6 sm:pr-72 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>巡检管理</span>
              <span aria-hidden="true">/</span>
              <span className="text-slate-800">{pageLabel}</span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900 sm:text-base">
              {title}
            </p>
          </div>
        </header>

        <nav
          aria-label="移动端主导航"
          className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 lg:hidden"
        >
          <Link
            href="/"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              activeItem === "new"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            新建巡检
          </Link>
          <Link
            href="/inspections"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              activeItem === "records"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            云端记录
          </Link>
          <Link
            href="/findings"
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
              activeItem === "findings"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            问题看板
          </Link>
          <Link
            href="/projects"
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
              activeItem === "projects"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            团队项目
          </Link>
        </nav>

        {children}
      </div>
    </div>
  );
}
