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

export const metadata: Metadata = { title: "问题看板 | Site Inspection AI" };

const statusLabels: Record<FindingStatus, string> = {
  OPEN: "待分配",
  ASSIGNED: "已分配",
  IN_PROGRESS: "整改中",
  AWAITING_VERIFICATION: "等待复核",
  CLOSED: "已关闭",
  REOPENED: "已重新打开",
};

const riskLabels: Record<FindingRisk, string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "严重风险",
  UNCONFIRMED: "风险待确认",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string | null) {
  if (!value) return "未设置";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : dateFormatter.format(date);
}

type SearchParams = Promise<{
  view?: string;
  project?: string;
  risk?: string;
  assignee?: string;
}>;

export default async function FindingsPage({ searchParams }: { searchParams: SearchParams }) {
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
    <ProductShell activeItem="findings" pageLabel="问题看板" title="整改任务与复核中心">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-3xl bg-[#0b1728] px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">CORRECTIVE ACTION DASHBOARD</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">项目问题看板</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">默认只展示未关闭问题。问题关闭后仍保留在历史和审计时间线中，不会删除正式记录。</p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="开放问题" value={open.length} tone="blue" />
          <Metric label="高风险" value={highRisk.length} tone="red" />
          <Metric label="已经超期" value={overdue.length} tone="amber" />
          <Metric label="等待复核" value={awaiting.length} tone="emerald" />
        </section>

        {!result.ok ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.error}</section>
        ) : (
          <>
            <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
              <FilterSelect name="view" label="显示范围" defaultValue={filters.view ?? "open"} options={[
                ["open", "全部开放问题"], ["mine", "分配给我的问题"], ["closed", "已关闭历史"], ["all", "全部问题"],
              ]} />
              <FilterSelect name="project" label="项目" defaultValue={filters.project ?? ""} options={[["", "全部项目"], ...projects.map((project) => [project.id, project.name] as [string, string])]} />
              <FilterSelect name="risk" label="风险" defaultValue={filters.risk ?? ""} options={[["", "全部风险"], ...Object.entries(riskLabels)]} />
              <FilterSelect name="assignee" label="负责人" defaultValue={filters.assignee ?? ""} options={[["", "全部"], ["unassigned", "仅未分配"]]} />
              <div className="flex items-end gap-2">
                <button type="submit" className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">应用筛选</button>
                <Link href="/findings" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">重置</Link>
              </div>
            </form>

            <section className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-semibold tracking-[0.16em] text-blue-600">FINDING QUEUE</p><h2 className="mt-1 text-xl font-bold text-slate-950">问题队列</h2></div>
                <p className="text-sm text-slate-500">显示 {filtered.length} 条</p>
              </div>
              {filtered.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <h3 className="font-bold text-slate-900">当前筛选条件下没有问题</h3>
                  <p className="mt-2 text-sm text-slate-500">如果开放问题为零，说明当前可访问项目没有待处理 finding。</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {filtered.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </ProductShell>
  );
}

function FindingCard({ finding }: { finding: FindingDashboardItem }) {
  return (
    <Link href={`/findings/${finding.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${riskClass(finding.riskLevel)}`}>{riskLabels[finding.riskLevel]}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabels[finding.status]}</span>
            {finding.isOverdue && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">已超期</span>}
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-950 group-hover:text-blue-700">{finding.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{finding.projectCode} · {finding.projectName} · {finding.location}</p>
        </div>
        <span className="text-xl text-slate-300 group-hover:text-blue-500">→</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
        <Info label="负责人" value={finding.assigneeName ?? "尚未分配"} />
        <Info label="截止时间" value={formatDate(finding.dueAt)} />
        <Info label="跟进记录" value={`${finding.followUpCount} 条`} />
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
