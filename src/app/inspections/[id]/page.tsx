import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductShell } from "@/components/product-shell";
import {
  getCloudInspectionDetail,
  type CloudDetection,
  type CloudFinding,
  type CloudInspectionDetail,
  type CloudInspectionPhoto,
} from "@/lib/cloud-inspection-queries";

export const metadata: Metadata = {
  title: "巡检详情 | Site Inspection AI",
};

const categoryLabels: Record<string, string> = {
  BLOCKED_ACCESS: "通道或出口堵塞",
  UNSAFE_CABLE: "电缆安全问题",
  MISSING_PPE: "缺少个人防护装备",
  IMPROPER_STORAGE: "材料堆放不规范",
};

const riskLabels: Record<string, string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "严重风险",
  UNCONFIRMED: "风险待确认",
};

const statusLabels: Record<string, string> = {
  OPEN: "待分配",
  ASSIGNED: "已分配",
  IN_PROGRESS: "整改中",
  AWAITING_VERIFICATION: "等待复核",
  CLOSED: "已关闭",
  REOPENED: "已重新打开",
};

const eventLabels: Record<string, string> = {
  CREATED: "创建问题",
  ASSIGNED: "分配负责人",
  STATUS_CHANGED: "更新状态",
  COMMENT_ADDED: "添加说明",
  EVIDENCE_ADDED: "补充证据",
  RISK_CHANGED: "调整风险等级",
  DUE_DATE_CHANGED: "调整截止时间",
  REOPENED: "重新打开",
  CLOSED: "关闭问题",
};

const detectionLabels: Record<string, string> = {
  Hardhat: "安全帽",
  Mask: "口罩",
  "NO-Hardhat": "未佩戴安全帽",
  "NO-Mask": "未佩戴口罩",
  "NO-Safety Vest": "未穿安全背心",
  Person: "人员",
  "Safety Cone": "安全锥",
  "Safety Vest": "安全背心",
  machinery: "机械设备",
  vehicle: "车辆",
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

function riskClass(risk: string) {
  if (risk === "CRITICAL" || risk === "HIGH") {
    return "bg-red-100 text-red-800";
  }
  if (risk === "MEDIUM" || risk === "UNCONFIRMED") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-emerald-100 text-emerald-800";
}

function statusClass(status: string) {
  if (status === "CLOSED") return "bg-emerald-100 text-emerald-800";
  if (status === "AWAITING_VERIFICATION") {
    return "bg-blue-100 text-blue-800";
  }
  return "bg-slate-100 text-slate-700";
}

function percentage(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function DetectionBox({
  detection,
  photo,
  referenced,
}: {
  detection: CloudDetection;
  photo: CloudInspectionPhoto;
  referenced: boolean;
}) {
  const violation = detection.label.startsWith("NO-");
  const color = referenced ? "#facc15" : violation ? "#dc2626" : "#2563eb";
  const left = percentage(detection.box.x, photo.width);
  const top = percentage(detection.box.y, photo.height);
  const width = percentage(detection.box.width, photo.width);
  const height = percentage(detection.box.height, photo.height);

  return (
    <span
      className="pointer-events-none absolute border-2"
      style={{
        borderColor: color,
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
    >
      <span
        className="absolute -top-6 left-[-2px] whitespace-nowrap px-1.5 py-1 text-[10px] font-bold text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {detectionLabels[detection.label] ?? detection.label} · {Math.round(detection.confidence * 100)}%
      </span>
    </span>
  );
}

function PhotoCard({
  photo,
  referencedDetectionIds,
}: {
  photo: CloudInspectionPhoto;
  referencedDetectionIds: Set<string>;
}) {
  const activeDetections = photo.detections.filter(
    (detection) => !detection.excludedByUser,
  );
  const excludedCount = photo.detections.length - activeDetections.length;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-900">
            {photo.originalFileName}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {photo.width} × {photo.height} · {(photo.sizeBytes / 1024).toFixed(0)} KB
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {activeDetections.length} 项检测
        </span>
      </div>

      {photo.signedUrl ? (
        <div className="bg-slate-950 p-3">
          <div
            className="relative mx-auto w-full overflow-hidden bg-black"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          >
            {/* Signed private Storage URL; native img avoids remote host config. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.signedUrl}
              alt={`巡检证据：${photo.originalFileName}`}
              className="block h-full w-full object-contain"
            />
            {activeDetections.map((detection) => (
              <DetectionBox
                key={detection.id}
                detection={detection}
                photo={photo}
                referenced={referencedDetectionIds.has(detection.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-56 items-center justify-center bg-slate-100 px-6 text-center text-sm text-slate-500">
          私有照片签名链接生成失败，请刷新页面重试。
        </div>
      )}

      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {activeDetections.length === 0 ? (
            <span className="text-sm text-slate-500">没有保留的检测结果</span>
          ) : (
            activeDetections.map((detection) => (
              <span
                key={detection.id}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  referencedDetectionIds.has(detection.id)
                    ? "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-300"
                    : detection.label.startsWith("NO-")
                      ? "bg-red-50 text-red-700"
                      : "bg-blue-50 text-blue-700"
                }`}
              >
                {detectionLabels[detection.label] ?? detection.label} {Math.round(detection.confidence * 100)}%
              </span>
            ))
          )}
        </div>
        {excludedCount > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            另有 {excludedCount} 项检测已由巡检员排除，不显示在证据图中。
          </p>
        )}
      </div>
    </article>
  );
}

function FindingCard({
  finding,
  photoNames,
}: {
  finding: CloudFinding;
  photoNames: Map<string, string>;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            {categoryLabels[finding.category] ?? finding.category}
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-950">
            {finding.title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskClass(finding.riskLevel)}`}>
            {riskLabels[finding.riskLevel] ?? finding.riskLevel}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(finding.status)}`}>
            {statusLabels[finding.status] ?? finding.status}
          </span>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <DetailTerm label="问题描述" value={finding.description} />
        <DetailTerm label="可见证据" value={finding.visibleEvidence} />
        <DetailTerm
          label="负责人"
          value={finding.assigneeName ?? "尚未分配"}
        />
        <DetailTerm label="整改期限" value={formatDate(finding.dueAt)} />
      </dl>

      <div className="mt-5 rounded-xl bg-blue-50 p-4">
        <p className="text-xs font-bold text-blue-700">建议整改措施</p>
        <p className="mt-2 text-sm leading-6 text-blue-950">
          {finding.correctiveAction}
        </p>
      </div>

      {finding.uncertainty.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-slate-500">仍需现场确认</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {finding.uncertainty.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {finding.evidencePhotoIds.length === 0 ? (
          <span className="text-xs text-slate-500">证据来自巡检文字备注</span>
        ) : (
          finding.evidencePhotoIds.map((photoId) => (
            <span
              key={photoId}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              证据照片：{photoNames.get(photoId) ?? "未知照片"}
            </span>
          ))
        )}
        {finding.evidenceDetectionIds.length > 0 && (
          <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-900">
            精确关联 {finding.evidenceDetectionIds.length} 个检测框
          </span>
        )}
      </div>

      {finding.events.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-bold tracking-wide text-slate-500">
            审计记录
          </p>
          <ol className="mt-3 space-y-3">
            {finding.events.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <p className="font-medium text-slate-800">
                    {event.actorName} · {eventLabels[event.eventType] ?? event.eventType}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(event.createdAt)}
                    {event.fromStatus && event.toStatus
                      ? ` · ${statusLabels[event.fromStatus] ?? event.fromStatus} → ${statusLabels[event.toStatus] ?? event.toStatus}`
                      : ""}
                  </p>
                  {event.comment && (
                    <p className="mt-1 text-sm text-slate-600">
                      {event.comment}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 leading-6 text-slate-800">{value}</dd>
    </div>
  );
}

export default async function InspectionDetailPage({
  params,
}: PageProps<"/inspections/[id]">) {
  const { id } = await params;
  const result = await getCloudInspectionDetail(id);

  if (!result.ok && result.status === 401) {
    redirect("/login");
  }

  if (!result.ok && result.status === 404) {
    notFound();
  }

  return (
    <ProductShell
      activeItem="records"
      pageLabel="巡检详情"
      title={result.ok ? result.data.inspectionNumber : "巡检详情"}
    >
      {result.ok ? (
        <InspectionDetailContent inspection={result.data} />
      ) : (
        <main className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-bold text-red-900">
              巡检详情暂时无法读取
            </h1>
            <p className="mt-2 text-sm text-red-700">{result.error}</p>
            <Link
              href="/inspections"
              className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
            >
              返回巡检列表
            </Link>
          </section>
        </main>
      )}
    </ProductShell>
  );
}

function InspectionDetailContent({
  inspection,
}: {
  inspection: CloudInspectionDetail;
}) {
  const photoNames = new Map(
    inspection.photos.map((photo) => [photo.id, photo.originalFileName]),
  );
  const referencedDetectionIds = new Set(
    inspection.findings.flatMap((finding) => finding.evidenceDetectionIds),
  );
  const openFindingCount = inspection.findings.filter(
    (finding) => finding.status !== "CLOSED",
  ).length;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/inspections"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
      >
        ← 返回云端巡检记录
      </Link>

      <section className="mt-5 overflow-hidden rounded-3xl bg-[#0b1728] px-6 py-7 text-white shadow-sm sm:px-8 sm:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-950">
                {inspection.projectCode}
              </span>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-300/20">
                {inspection.status === "ARCHIVED" ? "已归档" : "已提交"}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-bold sm:text-3xl">
              {inspection.inspectionNumber}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {inspection.summary || "本次巡检尚未填写摘要。"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-80">
            <HeroMetric label="问题" value={inspection.findings.length} />
            <HeroMetric label="未关闭" value={openFindingCount} />
            <HeroMetric label="照片" value={inspection.photos.length} />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <DetailTerm label="所属项目" value={inspection.projectName} />
        <DetailTerm label="巡检位置" value={inspection.location} />
        <DetailTerm label="巡检员" value={inspection.inspectorName} />
        <DetailTerm
          label="提交时间"
          value={formatDate(inspection.submittedAt)}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">
          INSPECTOR NOTE
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">巡检备注</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {inspection.note || "本次巡检没有填写文字备注。"}
        </p>
      </section>

      <section className="mt-8">
        <SectionTitle
          eyebrow="FORMAL FINDINGS"
          title="正式问题与整改要求"
          count={inspection.findings.length}
        />
        {inspection.findings.length === 0 ? (
          <EmptyBlock text="本次正式巡检没有问题记录。" />
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {inspection.findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                photoNames={photoNames}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle
          eyebrow="VISUAL EVIDENCE"
          title="私有证据照片与检测框"
          count={inspection.photos.length}
        />
        {inspection.photos.length === 0 ? (
          <EmptyBlock text="本次巡检没有保存证据照片。" />
        ) : (
          <div className="mt-4 grid items-start gap-5 xl:grid-cols-2">
            {inspection.photos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                referencedDetectionIds={referencedDetectionIds}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle
          eyebrow="REPORT ARCHIVE"
          title="正式报告归档"
          count={inspection.reports.length}
        />
        {inspection.reports.length === 0 ? (
          <EmptyBlock text="这条巡检尚未归档正式报告；当前仍可在新建巡检工作区生成本地 PDF。" />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inspection.reports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold text-blue-600">
                  {report.format} REPORT
                </p>
                <p className="mt-2 font-bold text-slate-900">
                  {formatDate(report.generatedAt)}
                </p>
                {report.signedUrl ? (
                  <a
                    href={report.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    安全下载
                  </a>
                ) : (
                  <p className="mt-3 text-sm text-red-600">
                    下载链接暂时不可用
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  count,
}: {
  eyebrow: string;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
      </div>
      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
        {count}
      </span>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
      {text}
    </div>
  );
}
