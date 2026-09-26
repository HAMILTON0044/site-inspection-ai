"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import type { InspectionAnalysis } from "@/lib/schemas";
import type { VisionDetection } from "@/lib/vision";
import { createClient } from "@/lib/supabase/client";
import { detectionLabel, type Locale } from "@/lib/i18n";

type ReviewDecision = "PENDING" | "APPROVED" | "REJECTED";

export type ReportSourcePhoto = {
  file: File;
  detections: VisionDetection[];
  excludedDetectionIndexes: number[];
};

type ReportDownloadProps = {
  note: string;
  analysis: InspectionAnalysis;
  reviewDecisions: Record<string, ReviewDecision>;
  photos: ReportSourcePhoto[];
  projectName: string;
  projectId?: string;
  inspectionId?: string;
  disabled: boolean;
};

function getReportNumber(date: Date) {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");

  return `SIR-${datePart}-${timePart}`;
}

async function renderPhotoForReport(photo: ReportSourcePhoto, locale: Locale) {
  const bitmap = await createImageBitmap(photo.file);
  const maxDimension = 1600;
  const scale = Math.min(
    1,
    maxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (context === null) {
    bitmap.close();
    throw new Error(locale === "zh" ? "无法创建报告图片画布。" : "Unable to create the report image canvas.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const excluded = new Set(photo.excludedDetectionIndexes);
  const includedDetections = photo.detections.filter(
    (_, index) => !excluded.has(index),
  );
  const lineWidth = Math.max(2, Math.round(4 * scale));
  const fontSize = Math.max(14, Math.round(22 * scale));

  includedDetections.forEach((detection) => {
    const isViolation = detection.label.startsWith("NO-");
    const color = isViolation ? "#dc2626" : "#2563eb";
    const x = detection.box.x * scale;
    const y = detection.box.y * scale;
    const width = detection.box.width * scale;
    const height = detection.box.height * scale;
    const label = `${detectionLabel(locale, detection.label)} ${Math.round(
      detection.confidence * 100,
    )}%`;

    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.strokeRect(x, y, width, height);
    context.font = `600 ${fontSize}px "Microsoft YaHei", sans-serif`;
    const labelWidth = context.measureText(label).width + 14;
    const labelHeight = fontSize + 10;
    const labelY = Math.max(0, y - labelHeight);
    context.fillStyle = color;
    context.fillRect(x, labelY, labelWidth, labelHeight);
    context.fillStyle = "#ffffff";
    context.fillText(label, x + 7, labelY + fontSize + 1);
  });

  return {
    name: photo.file.name,
    imageData: canvas.toDataURL("image/jpeg", 0.86),
    detectionSummary: includedDetections.map(
      (detection) =>
        `${detectionLabel(locale, detection.label)} ${Math.round(
          detection.confidence * 100,
        )}%`,
    ),
  };
}

async function loadInspectorName(locale: Locale) {
  try {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (user === null) {
      return locale === "zh" ? "当前巡检员" : "Current inspector";
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    return profile?.display_name || user.email || (locale === "zh" ? "当前巡检员" : "Current inspector");
  } catch {
    return locale === "zh" ? "当前巡检员" : "Current inspector";
  }
}

export function ReportDownload({
  note,
  analysis,
  reviewDecisions,
  photos,
  projectName,
  projectId,
  inspectionId,
  disabled,
}: ReportDownloadProps) {
  const { locale } = useLanguage();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const [generating, setGenerating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDownload() {
    setGenerating(true);
    setMessage("");

    try {
      const now = new Date();
      const reportNumber = getReportNumber(now);
      const [renderer, reportModule, inspectorName, reportPhotos] =
        await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/inspection-report-document"),
          loadInspectorName(locale),
          Promise.all(photos.map((photo) => renderPhotoForReport(photo, locale))),
        ]);

      reportModule.registerInspectionReportFonts(
        `${window.location.origin}/fonts`,
      );

      const approvedFindings = analysis.findings.filter(
        (finding) => reviewDecisions[finding.id] === "APPROVED",
      );
      const rejectedFindingCount = analysis.findings.filter(
        (finding) => reviewDecisions[finding.id] === "REJECTED",
      ).length;
      const reportData = {
        reportNumber,
        locale,
        projectName: projectName || l("未指定项目", "Unspecified project"),
        inspectorName,
        generatedAt: new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(now),
        note,
        analysis,
        approvedFindings,
        rejectedFindingCount,
        photos: reportPhotos,
      };
      const blob = await renderer
        .pdf(
          <reportModule.InspectionReportDocument data={reportData} />,
        )
        .toBlob();

      if (inspectionId && projectId) {
        setArchiving(true);
        const reportFileId = crypto.randomUUID();
        const storageKey = `${projectId}/${inspectionId}/reports/${reportNumber}-${reportFileId}.pdf`;
        const supabase = createClient();
        try {
          const { error: uploadError } = await supabase.storage
            .from("inspection-reports")
            .upload(storageKey, blob, {
              contentType: "application/pdf",
              upsert: false,
            });

          if (uploadError) {
            throw new Error(l(`报告归档上传失败：${uploadError.message}`, `Report archive upload failed: ${uploadError.message}`));
          }

          const archiveResponse = await fetch(`/api/inspections/${inspectionId}/reports`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storageKey, format: "PDF" }),
          });

          if (!archiveResponse.ok) {
            let archiveMessage = l("报告归档失败。", "Report archiving failed.");
            try {
              const archiveBody = (await archiveResponse.json()) as { error?: string };
              archiveMessage = archiveBody.error || archiveMessage;
            } catch {
              // Keep the user-facing fallback when the API response is not JSON.
            }
            throw new Error(archiveMessage);
          }
        } catch (archiveError) {
          const { error: cleanupError } = await supabase.storage
            .from("inspection-reports")
            .remove([storageKey]);
          if (cleanupError) {
            console.error("Failed to clean up archived report upload", cleanupError);
          }
          throw archiveError;
        } finally {
          setArchiving(false);
        }
      }

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${reportNumber}-${l("施工现场巡检报告", "site-inspection-report")}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setMessage(
        inspectionId && projectId
          ? l("PDF 报告已归档并开始下载。", "The PDF report has been archived and is downloading.")
          : l("PDF 报告已生成并开始下载。", "The PDF report has been generated and is downloading."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? l(`PDF 生成失败：${error.message}`, `PDF generation failed: ${error.message}`)
          : l("PDF 生成失败，请稍后重试。", "PDF generation failed. Please try again."),
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={disabled || generating}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4" />
          <path d="M12 10v6" />
          <path d="m9.5 13.5 2.5 2.5 2.5-2.5" />
        </svg>
        {generating
          ? archiving
            ? l("正在归档 PDF……", "Archiving PDF…")
            : l("正在生成 PDF……", "Generating PDF…")
          : inspectionId && projectId
            ? l("归档并下载 PDF", "Archive & download PDF")
            : l("下载正式 PDF 报告", "Download official PDF")}
      </button>
      {disabled && (
        <p className="text-right text-xs text-amber-700">
          {l("请先批准或驳回全部问题，再生成正式报告。", "Approve or reject every finding before generating the official report.")}
        </p>
      )}
      {message && (
        <p
          aria-live="polite"
          className={`text-right text-xs ${
            message.startsWith("PDF 生成失败") || message.startsWith("PDF generation failed")
              ? "text-red-700"
              : "text-emerald-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
