import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductShell } from "@/components/product-shell";
import {
  getCloudReportList,
  type CloudReportListItem,
} from "@/lib/cloud-inspection-queries";

export const metadata: Metadata = { title: "报告中心 | Site Inspection AI" };

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

export default async function ReportsPage() {
  const result = await getCloudReportList();
  if (!result.ok && result.status === 401) redirect("/login");

  const reports = result.ok ? result.data : [];
  const pdfCount = reports.filter((report) => report.format === "PDF").length;
  const inspectionCount = new Set(reports.map((report) => report.inspectionId)).size;

  return (
    <ProductShell activeItem="reports" pageLabel="报告中心" title="正式巡检报告归档">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-3xl bg-[#0b1728] px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">REPORT ARCHIVE</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">报告中心</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            集中查看已归档的正式巡检报告。报告文件存放在私有云端存储，并按当前账号的项目权限生成短期下载链接。
          </p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="报告版本" value={reports.length} />
          <Metric label="PDF 报告" value={pdfCount} tone="blue" />
          <Metric label="关联巡检" value={inspectionCount} tone="emerald" />
        </section>

        {!result.ok ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {result.error}
          </section>
        ) : reports.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h2 className="text-lg font-bold text-slate-900">暂无归档报告</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              完成巡检审核并提交云端后，在新建巡检工作区生成 PDF，即可在这里查看报告历史。
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              新建巡检
            </Link>
          </section>
        ) : (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">REPORT REGISTER</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">最近归档</h2>
              </div>
              <p className="text-sm text-slate-500">共 {reports.length} 个版本</p>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {reports.map((report) => <ReportCard key={report.id} report={report} />)}
            </div>
          </section>
        )}
      </main>
    </ProductShell>
  );
}

function ReportCard({ report }: { report: CloudReportListItem }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{report.format}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">已归档</span>
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-950">{report.inspectionNumber}</h2>
          <p className="mt-1 text-sm text-slate-600">{report.projectCode} · {report.projectName}</p>
        </div>
        <p className="shrink-0 text-right text-xs text-slate-500">{formatDate(report.generatedAt)}</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
        <Info label="巡检员" value={report.inspectorName} />
        <Info label="报告格式" value={`${report.format} 正式报告`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/inspections/${report.inspectionId}`}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
        >
          查看巡检
        </Link>
        {report.signedUrl ? (
          <a
            href={report.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            下载报告
          </a>
        ) : (
          <span className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">下载链接暂时不可用</span>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "blue" | "emerald" }) {
  const color = tone === "emerald" ? "bg-emerald-500" : tone === "blue" ? "bg-blue-600" : "bg-slate-400";
  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1 ${color}`} /><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-3"><p className="truncate text-sm font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}
