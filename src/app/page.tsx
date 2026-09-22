"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { InspectionAnalysis } from "@/lib/schemas";
import {
  detectPpe,
  type PpeLabel,
  type VisionDetection,
} from "@/lib/vision";

type AnalyzeResponse = {
  analysis: InspectionAnalysis;
  reviewed: boolean;
};

type Finding = InspectionAnalysis["findings"][number];

type ReviewDecision = "PENDING" | "APPROVED" | "REJECTED";

const categoryLabels: Record<Finding["category"], string> = {
  BLOCKED_ACCESS: "通道或出口堵塞",
  UNSAFE_CABLE: "电缆安全问题",
  MISSING_PPE: "缺少个人防护装备",
  IMPROPER_STORAGE: "材料堆放不规范",
};

const riskLabels: Record<Finding["risk_level"], string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "严重风险",
  UNCONFIRMED: "风险待确认",
};

const riskStyles: Record<Finding["risk_level"], string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
  UNCONFIRMED: "bg-slate-200 text-slate-700",
};

const ppeLabels: Record<PpeLabel, string> = {
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

export default function Home() {
  const [note, setNote] = useState(
    "三层东侧通道有建筑材料堵塞，旁边的电缆没有固定。",
  );
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<
    Record<number, ReviewDecision>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [detections, setDetections] = useState<VisionDetection[]>([]);
  const [visionError, setVisionError] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [hasDetected, setHasDetected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionsRef = useRef<VisionDetection[]>([]);
  const detectedImageRef = useRef<File | null>(null);

  useEffect(() => {
    if (previewUrl.length === 0) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null || previewUrl.length === 0) {
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) {
        return;
      }

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");

      if (context === null) {
        return;
      }

      context.drawImage(image, 0, 0);
      const lineWidth = Math.max(2, image.naturalWidth / 400);
      const fontSize = Math.max(16, image.naturalWidth / 55);
      context.lineWidth = lineWidth;
      context.font = `600 ${fontSize}px sans-serif`;
      context.textBaseline = "top";

      for (const detection of detections) {
        const isViolation = detection.label.startsWith("NO-");
        const color = isViolation ? "#dc2626" : "#2563eb";
        const label = `${ppeLabels[detection.label]} ${Math.round(
          detection.confidence * 100,
        )}%`;
        const textWidth = context.measureText(label).width;
        const labelHeight = fontSize + 10;
        const labelY = Math.max(0, detection.box.y - labelHeight);

        context.strokeStyle = color;
        context.strokeRect(
          detection.box.x,
          detection.box.y,
          detection.box.width,
          detection.box.height,
        );
        context.fillStyle = color;
        context.fillRect(
          detection.box.x,
          labelY,
          textWidth + 12,
          labelHeight,
        );
        context.fillStyle = "#ffffff";
        context.fillText(
          label,
          detection.box.x + 6,
          labelY + 5,
        );
      }
    };

    image.src = previewUrl;

    return () => {
      cancelled = true;
    };
  }, [detections, previewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    setVisionError("");
    setDetections([]);
    setHasDetected(false);
    detectionsRef.current = [];
    detectedImageRef.current = null;

    if (selectedFile === null) {
      setImageFile(null);
      setPreviewUrl("");
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setImageFile(null);
      setPreviewUrl("");
      setVisionError("请选择 JPEG、PNG 或 WebP 图片。");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setImageFile(null);
      setPreviewUrl("");
      setVisionError("图片不能超过 10 MB。");
      return;
    }

    setImageFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  }

  async function handleImageDetection() {
    if (imageFile === null) {
      setVisionError("请先选择一张施工现场图片。");
      return;
    }

    setDetecting(true);
    setVisionError("");
    setHasDetected(false);

    try {
      const nextDetections = await detectPpe(imageFile);
      detectionsRef.current = nextDetections;
      detectedImageRef.current = imageFile;
      setDetections(nextDetections);
      setHasDetected(true);
    } catch (detectionError) {
      setVisionError(
        detectionError instanceof Error
          ? detectionError.message
          : "图片识别失败。",
      );
    } finally {
      setDetecting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);
    setReviewDecisions({});

    try {
      let visionDetections = detectionsRef.current;

      if (
        imageFile !== null &&
        detectedImageRef.current !== imageFile
      ) {
        setDetecting(true);
        visionDetections = await detectPpe(imageFile);
        detectionsRef.current = visionDetections;
        detectedImageRef.current = imageFile;
        setDetections(visionDetections);
        setHasDetected(true);
        setDetecting(false);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note,
          visionDetections: visionDetections.map((detection) => ({
            label: detection.label,
            confidence: detection.confidence,
            box: detection.box,
          })),
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const errorData = data as {
          message?: string;
          error?: string;
        };

        throw new Error(
          errorData.message ??
            errorData.error ??
            "巡检分析失败",
        );
      }

      setResult(data as AnalyzeResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "发生未知错误",
      );
    } finally {
      setDetecting(false);
      setLoading(false);
    }
  }

  function updateReviewDecision(
    findingIndex: number,
    decision: ReviewDecision,
  ) {
    setReviewDecisions((currentDecisions) => ({
      ...currentDecisions,
      [findingIndex]: decision,
    }));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-lg">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Site Inspection AI
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            AI 现场巡检分析
          </h1>

          <p className="mt-3 text-slate-600">
            在浏览器中识别现场照片，并结合巡检备注生成等待人工确认的问题草稿。
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8">
          <fieldset>
            <legend className="font-semibold text-slate-800">
              现场照片
            </legend>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />

            <p className="mt-2 text-sm text-slate-500">
              图片只在当前浏览器中由 YOLOv8 分析，不会上传给 LLM。支持 JPEG、PNG 和 WebP，最大 10 MB。
            </p>

            {previewUrl.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-2">
                <canvas
                  ref={canvasRef}
                  className="h-auto max-h-[640px] w-full object-contain"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleImageDetection}
              disabled={detecting || imageFile === null}
              className="mt-4 rounded-xl border border-blue-600 px-5 py-2.5 font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {detecting ? "正在加载模型并识别……" : "识别照片"}
            </button>

            {visionError.length > 0 && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {visionError}
              </p>
            )}

            {hasDetected && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-800">
                  视觉检测结果
                </p>

                {detections.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    当前阈值下未检测到模型支持的目标，请人工检查照片。
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    {detections.map((detection, index) => (
                      <li
                        key={`${detection.label}-${index}`}
                        className="rounded-lg bg-white px-3 py-2"
                      >
                        {ppeLabels[detection.label]} ·{" "}
                        {Math.round(detection.confidence * 100)}%
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </fieldset>

          <label
            htmlFor="inspection-note"
            className="mt-8 block font-semibold text-slate-800"
          >
            巡检备注
          </label>

          <textarea
            id="inspection-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={7}
            placeholder="例如：三层东侧通道有建筑材料堵塞……"
            className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="submit"
            disabled={loading || detecting || note.trim().length < 3}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {detecting
              ? "正在识别照片……"
              : loading
                ? "AI 正在分析……"
                : "开始分析"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">分析失败</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {result !== null && (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">
                AI 分析草稿
              </h2>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                等待人工审核
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              以下内容由 AI 生成，不能直接作为最终安全结论。
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">
                巡检位置
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {result.analysis.location}
              </p>

              <p className="mt-4 text-sm font-medium text-slate-500">
                分析摘要
              </p>
              <p className="mt-1 text-slate-800">
                {result.analysis.summary}
              </p>
            </div>

            {result.analysis.findings.length === 0 ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                当前备注中没有识别到系统支持的问题。
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {result.analysis.findings.map((finding, index) => (
                  <article
                    key={`${finding.category}-${index}`}
                    className="rounded-xl border border-slate-200 p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-blue-600">
                          问题 {index + 1} ·{" "}
                          {categoryLabels[finding.category]}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {finding.title}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          riskStyles[finding.risk_level]
                        }`}
                      >
                        {riskLabels[finding.risk_level]}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-4">
                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          问题描述
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.description}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          可见证据
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.visible_evidence}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          建议整改措施
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.corrective_action}
                        </dd>
                      </div>
                    </dl>

                    {finding.uncertainty.length > 0 && (
                      <div className="mt-5 rounded-lg bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">
                          待人工确认
                        </p>

                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                          {finding.uncertainty.map(
                            (item, itemIndex) => (
                              <li key={`${item}-${itemIndex}`}>
                                {item}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <p className="text-sm font-medium text-slate-600">
                        审核状态：
                        {reviewDecisions[index] === "APPROVED"
                          ? "已批准"
                          : reviewDecisions[index] === "REJECTED"
                            ? "已驳回"
                            : "等待审核"}
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateReviewDecision(
                              index,
                              "REJECTED",
                            )
                          }
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            reviewDecisions[index] === "REJECTED"
                              ? "border-red-600 bg-red-600 text-white"
                              : "border-red-200 text-red-700 hover:bg-red-50"
                          }`}
                        >
                          驳回
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateReviewDecision(
                              index,
                              "APPROVED",
                            )
                          }
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            reviewDecisions[index] === "APPROVED"
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          批准
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
