import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductShell } from "@/components/product-shell";
import {
  getCloudInspectionList,
  type CloudInspectionListItem,
} from "@/lib/cloud-inspection-queries";

export const metadata: Metadata = {
  title: "云端巡检记录 | Site Inspection AI",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : dateFormatter.format(date);
}

function InspectionCard({ inspection }: { inspection: CloudInspectionListItem }) {
  return (
    <Link
      href={`/inspections/${inspection.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {inspection.projectCode}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                inspection.status === "ARCHIVED"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {inspection.status === "ARCHIVED" ? "已归档" : "已提交"}
            </span>
          </div>
          <h2 className="mt-3 truncate text-lg font-bold text-slate-950 transition group-hover:text-blue-700">
            {inspection.inspectionNumber}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-700">
            {inspection.projectName} · {inspection.location}
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
            {inspection.summary || "本次巡检尚未填写摘要。"}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-semibold text-slate-800">
            {inspection.inspectorName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(inspection.submittedAt)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-5">
        <Metric label="问题" value={inspection.findingCount} />
        <Metric
          label="未关闭"
          value={inspection.openFindingCount}
          tone={inspection.openFindingCount > 0 ? "amber" : "default"}
        />
        <Metric
          label="高风险"
          value={inspection.highRiskFindingCount}
          tone={inspection.highRiskFindingCount > 0 ? "red" : "default"}
        />
        <Metric label="照片" value={inspection.photoCount} />
        <Metric label="报告" value={inspection.reportCount} />
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "red";
}) {
  const color =
    tone === "red"
      ? "text-red-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-slate-900";

  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default async function InspectionsPage() {
  const result = await getCloudInspectionList();

  if (!result.ok && result.status === 401) {
    redirect("/login");
  }

  const inspections = result.ok ? result.data : [];
  const openFindingCount = inspections.reduce(
    (total, inspection) => total + inspection.openFindingCount,
    0,
  );
  const highRiskFindingCount = inspections.reduce(
    (total, inspection) => total + inspection.highRiskFindingCount,
    0,
  );

  return (
    <ProductShell
      activeItem="records"
      pageLabel="云端巡检记录"
      title="已提交巡检与团队证据中心"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-3xl bg-[#0b1728] px-6 py-7 text-white shadow-sm sm:px-8 sm:py-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">
                CLOUD INSPECTION REGISTER
              </p>
              <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
                云端正式巡检记录
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                这里仅展示已经正式提交或归档的记录。草稿仍只对创建者可见，并保留在新建巡检工作区中。
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex w-fit items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
            >
              + 新建智能巡检
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="正式巡检" value={inspections.length} />
          <SummaryCard
            label="待处理问题"
            value={openFindingCount}
            tone={openFindingCount > 0 ? "amber" : "default"}
          />
          <SummaryCard
            label="高风险问题"
            value={highRiskFindingCount}
            tone={highRiskFindingCount > 0 ? "red" : "default"}
          />
        </section>

        {!result.ok ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-bold text-red-900">云端记录暂时无法读取</h2>
            <p className="mt-2 text-sm text-red-700">{result.error}</p>
          </section>
        ) : inspections.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
              ✓
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              暂无正式巡检记录
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              完成照片识别、AI 分析和人工审核后，选择所属项目并提交到云端，正式记录会显示在这里。
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              开始第一次巡检
            </Link>
          </section>
        ) : (
          <section className="mt-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">
                  INSPECTION LOG
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  最近提交
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                共 {inspections.length} 条
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {inspections.map((inspection) => (
                <InspectionCard key={inspection.id} inspection={inspection} />
              ))}
            </div>
          </section>
        )}
      </main>
    </ProductShell>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "red";
}) {
  const accent =
    tone === "red"
      ? "bg-red-500"
      : tone === "amber"
        ? "bg-amber-400"
        : "bg-blue-600";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
