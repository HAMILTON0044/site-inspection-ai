import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FindingWorkflowPanel } from "@/components/finding-workflow-panel";
import { ProductShell } from "@/components/product-shell";
import { getFindingDetail, type FindingRisk, type FindingStatus } from "@/lib/finding-queries";
import { getLocale } from "@/lib/i18n-server";
import { categoryLabel, riskLabel, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { title: "问题详情 | Site Inspection AI" };

function statusLabel(locale: Locale, status: FindingStatus) {
  const labels: Record<FindingStatus, [string, string]> = { OPEN: ["待分配", "Open"], ASSIGNED: ["已分配", "Assigned"], IN_PROGRESS: ["整改中", "In progress"], AWAITING_VERIFICATION: ["等待复核", "Awaiting verification"], CLOSED: ["已关闭", "Closed"], REOPENED: ["已重新打开", "Reopened"] };
  return labels[status][locale === "zh" ? 0 : 1];
}

function eventLabel(locale: Locale, event: string) {
  const labels: Record<string, [string, string]> = { CREATED: ["创建问题", "Finding created"], ASSIGNED: ["调整负责人", "Assignee changed"], STATUS_CHANGED: ["更新状态", "Status updated"], COMMENT_ADDED: ["添加整改说明", "Corrective note added"], EVIDENCE_ADDED: ["添加整改证据", "Evidence added"], RISK_CHANGED: ["调整风险等级", "Risk level changed"], DUE_DATE_CHANGED: ["调整整改期限", "Due date changed"], REOPENED: ["重新打开问题", "Finding reopened"], CLOSED: ["复核通过并关闭", "Verified and closed"] };
  return labels[event]?.[locale === "zh" ? 0 : 1] ?? event;
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

export default async function FindingDetailPage({ params }: PageProps<"/findings/[id]">) {
  const locale = await getLocale();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const { id } = await params;
  const result = await getFindingDetail(id);
  if (!result.ok && result.status === 401) redirect("/login");
  if (!result.ok && result.status === 404) notFound();

  return (
    <ProductShell activeItem="findings" pageLabel={l("问题详情", "Finding Details")} title={result.ok ? result.data.title : l("问题详情", "Finding Details")}>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link href="/findings" className="text-sm font-semibold text-slate-600 hover:text-blue-700">← {l("返回问题看板", "Back to findings")}</Link>
        {!result.ok ? (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.error}</section>
        ) : (
          <>
            <section className="mt-5 rounded-3xl bg-[#0b1728] px-6 py-8 text-white sm:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${riskClass(result.data.riskLevel)}`}>{riskLabel(locale, result.data.riskLevel)}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">{statusLabel(locale, result.data.status)}</span>
                    <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-950">{result.data.projectCode}</span>
                  </div>
                  <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-blue-300">{categoryLabel(locale, result.data.category)}</p>
                  <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{result.data.title}</h1>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{result.data.description}</p>
                </div>
                <Link href={`/inspections/${result.data.inspectionId}`} className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/15">{l("查看原巡检报告", "View original inspection")}</Link>
              </div>
            </section>

            <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
              <Detail label={l("所属项目", "Project")} value={result.data.projectName} />
              <Detail label={l("巡检位置", "Location")} value={result.data.location} />
              <Detail label={l("负责人", "Assignee")} value={result.data.assigneeName ?? l("尚未分配", "Unassigned")} />
              <Detail label={l("整改期限", "Due date")} value={formatDate(result.data.dueAt, locale)} />
            </section>

            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.78fr)]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-bold text-slate-950">{l("问题依据与整改要求", "Evidence & Corrective Requirements")}</h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <Detail label={l("可见证据", "Visible evidence")} value={result.data.visibleEvidence} />
                    <Detail label={l("建议整改措施", "Recommended corrective action")} value={result.data.correctiveAction} />
                  </div>
                  {result.data.uncertainty.length > 0 && (
                    <div className="mt-5 rounded-xl bg-amber-50 p-4">
                      <p className="text-xs font-bold text-amber-800">{l("仍需现场确认", "Requires site confirmation")}</p>
                      <ul className="mt-2 space-y-1 text-sm text-amber-950">{result.data.uncertainty.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.16em] text-blue-600">CORRECTIVE LOG</p><h2 className="mt-1 text-xl font-bold text-slate-950">{l("整改跟进记录", "Corrective-action log")}</h2></div><span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">{result.data.followUps.length}</span></div>
                  {result.data.followUps.length === 0 ? (
                    <Empty text={l("还没有整改跟进记录。", "No corrective-action updates yet.")} />
                  ) : (
                    <div className="mt-4 space-y-4">
                      {result.data.followUps.map((followUp) => (
                        <article key={followUp.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex items-center justify-between gap-4"><p className="font-bold text-slate-900">{followUp.authorName}</p><p className="text-xs text-slate-500">{formatDate(followUp.createdAt, locale)}</p></div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{followUp.comment}</p>
                          {followUp.photos.length > 0 && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {followUp.photos.map((photo) => photo.signedUrl ? (
                                <a key={photo.id} href={photo.signedUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                                  {/* Private, short-lived Supabase signed URL. */}
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={photo.signedUrl} alt={`${l("整改证据", "Corrective evidence")}：${photo.originalFileName}`} className="aspect-video h-auto w-full object-contain" />
                                  <p className="truncate bg-white px-3 py-2 text-xs text-slate-600">{photo.originalFileName}</p>
                                </a>
                              ) : <div key={photo.id} className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">{l("照片链接暂时不可用", "Photo link unavailable")}</div>)}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.16em] text-blue-600">AUDIT TRAIL</p><h2 className="mt-1 text-xl font-bold text-slate-950">{l("不可变审计时间线", "Immutable audit trail")}</h2></div><span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">{result.data.events.length}</span></div>
                  <ol className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    {result.data.events.map((event, index) => (
                      <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < result.data.events.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
                        <span className="relative mt-1.5 h-3 w-3 shrink-0 rounded-full bg-blue-600 ring-4 ring-blue-50" />
                        <div><p className="text-sm font-bold text-slate-900">{event.actorName} · {eventLabel(locale, event.eventType)}</p><p className="mt-1 text-xs text-slate-500">{formatDate(event.createdAt, locale)}{event.fromStatus && event.toStatus ? ` · ${statusLabel(locale, event.fromStatus)} → ${statusLabel(locale, event.toStatus)}` : ""}</p>{event.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.comment}</p>}</div>
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
