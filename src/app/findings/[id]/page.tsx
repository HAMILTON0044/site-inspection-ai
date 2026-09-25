import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FindingWorkflowPanel } from "@/components/finding-workflow-panel";
import { ProductShell } from "@/components/product-shell";
import { getFindingDetail, type FindingRisk, type FindingStatus } from "@/lib/finding-queries";

export const metadata: Metadata = { title: "问题详情 | Site Inspection AI" };

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

const eventLabels: Record<string, string> = {
  CREATED: "创建问题",
  ASSIGNED: "调整负责人",
  STATUS_CHANGED: "更新状态",
  COMMENT_ADDED: "添加整改说明",
  EVIDENCE_ADDED: "添加整改证据",
  RISK_CHANGED: "调整风险等级",
  DUE_DATE_CHANGED: "调整整改期限",
  REOPENED: "重新打开问题",
  CLOSED: "复核通过并关闭",
};

const categoryLabels: Record<string, string> = {
  BLOCKED_ACCESS: "通道或出口堵塞",
  UNSAFE_CABLE: "电缆安全问题",
  MISSING_PPE: "缺少个人防护装备",
  IMPROPER_STORAGE: "材料堆放不规范",
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

export default async function FindingDetailPage({ params }: PageProps<"/findings/[id]">) {
  const { id } = await params;
  const result = await getFindingDetail(id);
  if (!result.ok && result.status === 401) redirect("/login");
  if (!result.ok && result.status === 404) notFound();

  return (
    <ProductShell activeItem="findings" pageLabel="问题详情" title={result.ok ? result.data.title : "问题详情"}>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link href="/findings" className="text-sm font-semibold text-slate-600 hover:text-blue-700">← 返回问题看板</Link>
        {!result.ok ? (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.error}</section>
        ) : (
          <>
            <section className="mt-5 rounded-3xl bg-[#0b1728] px-6 py-8 text-white sm:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${riskClass(result.data.riskLevel)}`}>{riskLabels[result.data.riskLevel]}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">{statusLabels[result.data.status]}</span>
                    <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-950">{result.data.projectCode}</span>
                  </div>
                  <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-blue-300">{categoryLabels[result.data.category] ?? result.data.category}</p>
                  <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{result.data.title}</h1>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{result.data.description}</p>
                </div>
                <Link href={`/inspections/${result.data.inspectionId}`} className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/15">查看原巡检报告</Link>
              </div>
            </section>

            <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="所属项目" value={result.data.projectName} />
              <Detail label="巡检位置" value={result.data.location} />
              <Detail label="负责人" value={result.data.assigneeName ?? "尚未分配"} />
              <Detail label="整改期限" value={formatDate(result.data.dueAt)} />
            </section>

            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.78fr)]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-bold text-slate-950">问题依据与整改要求</h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <Detail label="可见证据" value={result.data.visibleEvidence} />
                    <Detail label="建议整改措施" value={result.data.correctiveAction} />
                  </div>
                  {result.data.uncertainty.length > 0 && (
                    <div className="mt-5 rounded-xl bg-amber-50 p-4">
                      <p className="text-xs font-bold text-amber-800">仍需现场确认</p>
                      <ul className="mt-2 space-y-1 text-sm text-amber-950">{result.data.uncertainty.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.16em] text-blue-600">CORRECTIVE LOG</p><h2 className="mt-1 text-xl font-bold text-slate-950">整改跟进记录</h2></div><span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">{result.data.followUps.length}</span></div>
                  {result.data.followUps.length === 0 ? (
                    <Empty text="还没有整改跟进记录。" />
                  ) : (
                    <div className="mt-4 space-y-4">
                      {result.data.followUps.map((followUp) => (
                        <article key={followUp.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex items-center justify-between gap-4"><p className="font-bold text-slate-900">{followUp.authorName}</p><p className="text-xs text-slate-500">{formatDate(followUp.createdAt)}</p></div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{followUp.comment}</p>
                          {followUp.photos.length > 0 && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {followUp.photos.map((photo) => photo.signedUrl ? (
                                <a key={photo.id} href={photo.signedUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                                  {/* Private, short-lived Supabase signed URL. */}
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={photo.signedUrl} alt={`整改证据：${photo.originalFileName}`} className="aspect-video h-auto w-full object-contain" />
                                  <p className="truncate bg-white px-3 py-2 text-xs text-slate-600">{photo.originalFileName}</p>
                                </a>
                              ) : <div key={photo.id} className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">照片链接暂时不可用</div>)}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.16em] text-blue-600">AUDIT TRAIL</p><h2 className="mt-1 text-xl font-bold text-slate-950">不可变审计时间线</h2></div><span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">{result.data.events.length}</span></div>
                  <ol className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    {result.data.events.map((event, index) => (
                      <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < result.data.events.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
                        <span className="relative mt-1.5 h-3 w-3 shrink-0 rounded-full bg-blue-600 ring-4 ring-blue-50" />
                        <div><p className="text-sm font-bold text-slate-900">{event.actorName} · {eventLabels[event.eventType] ?? event.eventType}</p><p className="mt-1 text-xs text-slate-500">{formatDate(event.createdAt)}{event.fromStatus && event.toStatus ? ` · ${statusLabels[event.fromStatus]} → ${statusLabels[event.toStatus]}` : ""}</p>{event.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.comment}</p>}</div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <aside className="xl:sticky xl:top-24">
                <FindingWorkflowPanel
                  finding={{
                    id: result.data.id,
                    projectId: result.data.projectId,
                    inspectionId: result.data.inspectionId,
                    status: result.data.status,
                    riskLevel: result.data.riskLevel,
                    assigneeId: result.data.assigneeId,
                    dueAt: result.data.dueAt,
                    projectMembers: result.data.projectMembers,
                  }}
                  currentUser={{ id: result.currentUser.id, role: result.currentUser.role }}
                />
              </aside>
            </div>
          </>
        )}
      </main>
    </ProductShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">{text}</div>;
}

function riskClass(risk: FindingRisk) {
  if (risk === "HIGH" || risk === "CRITICAL") return "bg-red-100 text-red-800";
  if (risk === "MEDIUM" || risk === "UNCONFIRMED") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}
