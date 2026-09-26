import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductShell } from "@/components/product-shell";
import {
  getFindingDashboard,
  type FindingDashboardItem,
  type FindingRisk,
  type FindingStatus,
} from "@/lib/finding-queries";
import { getLocale } from "@/lib/i18n-server";
import { riskLabel, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { title: "问题看板 | Site Inspection AI" };

function statusLabel(locale: Locale, status: FindingStatus) {
  const labels: Record<FindingStatus, [string, string]> = {
    OPEN: ["待分配", "Open"], ASSIGNED: ["已分配", "Assigned"], IN_PROGRESS: ["整改中", "In progress"],
    AWAITING_VERIFICATION: ["等待复核", "Awaiting verification"], CLOSED: ["已关闭", "Closed"], REOPENED: ["已重新打开", "Reopened"],
  };
  return labels[status][locale === "zh" ? 0 : 1];
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return locale === "zh" ? "未设置" : "Not set";
  const dateFormatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  });
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (locale === "zh" ? "时间未知" : "Time unavailable") : dateFormatter.format(date);
}

type SearchParams = Promise<{
  view?: string;
  project?: string;
  risk?: string;
  assignee?: string;
}>;

export default async function FindingsPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await getLocale();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const filters = await searchParams;
  const result = await getFindingDashboard();
  if (!result.ok && result.status === 401) redirect("/login");

  const findings = result.ok ? result.data : [];
  const currentUserId = result.ok ? result.currentUser.id : "";
  const open = findings.filter((finding) => finding.status !== "CLOSED");
  const highRisk = open.filter((finding) => finding.riskLevel === "HIGH" || finding.riskLevel === "CRITICAL");
  const overdue = open.filter((finding) => finding.isOverdue);
  const awaiting = open.filter((finding) => finding.status === "AWAITING_VERIFICATION");
  const projects = Array.from(new Map(findings.map((finding) => [finding.projectId, { id: finding.projectId, name: finding.projectName }])).values());

  const filtered = findings.filter((finding) => {
    const view = filters.view ?? "open";
    if (view === "open" && finding.status === "CLOSED") return false;
    if (view === "closed" && finding.status !== "CLOSED") return false;
    if (view === "mine" && finding.assigneeId !== currentUserId) return false;
    if (filters.project && finding.projectId !== filters.project) return false;
    if (filters.risk && finding.riskLevel !== filters.risk) return false;
    if (filters.assignee === "unassigned" && finding.assigneeId) return false;
    return true;
  });

  return (
    <ProductShell activeItem="findings" pageLabel={l("问题看板", "Findings Board")} title={l("整改任务与复核中心", "Corrective Actions & Verification")}>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-3xl bg-[#0b1728] px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">CORRECTIVE ACTION DASHBOARD</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{l("项目问题看板", "Project Findings Board")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{l("默认只展示未关闭问题。问题关闭后仍保留在历史和审计时间线中，不会删除正式记录。", "Open findings are shown by default. Closed findings remain in history and the audit trail; official records are never deleted.")}</p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={l("开放问题", "Open findings")} value={open.length} tone="blue" />
          <Metric label={l("高风险", "High risk")} value={highRisk.length} tone="red" />
          <Metric label={l("已经超期", "Overdue")} value={overdue.length} tone="amber" />
          <Metric label={l("等待复核", "Awaiting verification")} value={awaiting.length} tone="emerald" />
        </section>

        {!result.ok ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.error}</section>
        ) : (
          <>
            <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
              <FilterSelect name="view" label={l("显示范围", "View")} defaultValue={filters.view ?? "open"} options={[
                ["open", l("全部开放问题", "All open findings")], ["mine", l("分配给我的问题", "Assigned to me")], ["closed", l("已关闭历史", "Closed history")], ["all", l("全部问题", "All findings")],
              ]} />
              <FilterSelect name="project" label={l("项目", "Project")} defaultValue={filters.project ?? ""} options={[["", l("全部项目", "All projects")], ...projects.map((project) => [project.id, project.name] as [string, string])]} />
              <FilterSelect name="risk" label={l("风险", "Risk")} defaultValue={filters.risk ?? ""} options={[["", l("全部风险", "All risks")], ...(["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNCONFIRMED"] as FindingRisk[]).map((risk) => [risk, riskLabel(locale, risk)] as [string, string])]} />
              <FilterSelect name="assignee" label={l("负责人", "Assignee")} defaultValue={filters.assignee ?? ""} options={[["", l("全部", "All")], ["unassigned", l("仅未分配", "Unassigned only")]]} />
              <div className="flex items-end gap-2">
                <button type="submit" className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">{l("应用筛选", "Apply")}</button>
                <Link href="/findings" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">{l("重置", "Reset")}</Link>
              </div>
            </form>

            <section className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-semibold tracking-[0.16em] text-blue-600">FINDING QUEUE</p><h2 className="mt-1 text-xl font-bold text-slate-950">{l("问题队列", "Finding queue")}</h2></div>
                <p className="text-sm text-slate-500">{filtered.length} {l("条", "shown")}</p>
              </div>
              {filtered.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <h3 className="font-bold text-slate-900">{l("当前筛选条件下没有问题", "No findings match these filters")}</h3>
                  <p className="mt-2 text-sm text-slate-500">{l("如果开放问题为零，说明当前可访问项目没有待处理 finding。", "If the open count is zero, your accessible projects have no pending findings.")}</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {filtered.map((finding) => <FindingCard key={finding.id} finding={finding} locale={locale} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </ProductShell>
  );
}

function FindingCard({ finding, locale }: { finding: FindingDashboardItem; locale: Locale }) {
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  return (
    <Link href={`/findings/${finding.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${riskClass(finding.riskLevel)}`}>{riskLabel(locale, finding.riskLevel)}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabel(locale, finding.status)}</span>
            {finding.isOverdue && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">{l("已超期", "Overdue")}</span>}
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-950 group-hover:text-blue-700">{finding.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{finding.projectCode} · {finding.projectName} · {finding.location}</p>
        </div>
        <span className="text-xl text-slate-300 group-hover:text-blue-500">→</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
        <Info label={l("负责人", "Assignee")} value={finding.assigneeName ?? l("尚未分配", "Unassigned")} />
        <Info label={l("截止时间", "Due date")} value={formatDate(finding.dueAt, locale)} />
        <Info label={l("跟进记录", "Updates")} value={`${finding.followUpCount}`} />
      </div>
    </Link>
  );
}

function FilterSelect({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: Array<[string, string]> }) {
  return <label className="text-xs font-bold text-slate-500">{label}<select name={name} defaultValue={defaultValue} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800">{options.map(([value, text]) => <option key={value || "all"} value={value}>{text}</option>)}</select></label>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "blue" | "red" | "amber" | "emerald" }) {
  const bar = { blue: "bg-blue-600", red: "bg-red-500", amber: "bg-amber-400", emerald: "bg-emerald-500" }[tone];
  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1 ${bar}`} /><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-3"><p className="truncate text-sm font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

function riskClass(risk: FindingRisk) {
  if (risk === "HIGH" || risk === "CRITICAL") return "bg-red-100 text-red-800";
  if (risk === "MEDIUM" || risk === "UNCONFIRMED") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}
