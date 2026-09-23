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

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  detectionStatus: "IDLE" | "RUNNING" | "DONE" | "ERROR";
  detections: VisionDetection[];
  excludedDetectionIndexes: number[];
  error: string;
};

type BatchDetectionProgress = {
  completed: number;
  total: number;
  failed: number;
  currentPhotoName: string;
};

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

const EMPTY_DETECTIONS: VisionDetection[] = [];
const EMPTY_EXCLUDED_INDEXES: number[] = [];

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
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [batchProgress, setBatchProgress] =
    useState<BatchDetectionProgress | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const activePhoto =
    photos.find((photo) => photo.id === activePhotoId) ?? null;
  const imageFile = activePhoto?.file ?? null;
  const previewUrl = activePhoto?.previewUrl ?? "";
  const detections = activePhoto?.detections ?? EMPTY_DETECTIONS;
  const visionError = activePhoto?.error ?? "";
  const hasDetected = activePhoto?.detectionStatus === "DONE";
  const excludedDetectionIndexes =
    activePhoto?.excludedDetectionIndexes ?? EMPTY_EXCLUDED_INDEXES;
  const allPhotosDetected =
    photos.length > 0 &&
    photos.every((photo) => photo.detectionStatus === "DONE");
  const isBatchDetecting =
    detecting &&
    batchProgress !== null &&
    batchProgress.currentPhotoName.length > 0;

  function updatePhoto(
    photoId: string,
    update: (photo: SelectedPhoto) => SelectedPhoto,
  ) {
    const nextPhotos = photosRef.current.map((photo) =>
      photo.id === photoId ? update(photo) : photo,
    );

    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
  }

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

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
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > 10) {
      event.target.value = "";
      setError("一次最多选择 10 张图片。");
      return;
    }

    if (selectedFiles.some((file) => !file.type.startsWith("image/"))) {
      event.target.value = "";
      setError("请选择 JPEG、PNG 或 WebP 图片。");
      return;
    }

    if (selectedFiles.some((file) => file.size > 10 * 1024 * 1024)) {
      event.target.value = "";
      setError("每张图片不能超过 10 MB。");
      return;
    }

    const nextPhotos = selectedFiles.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
      detectionStatus: "IDLE" as const,
      detections: [],
      excludedDetectionIndexes: [],
      error: "",
    }));

    for (const photo of photosRef.current) {
      URL.revokeObjectURL(photo.previewUrl);
    }

    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    setActivePhotoId(nextPhotos[0].id);
    setBatchProgress(null);
    setError("");
    setResult(null);
    setReviewDecisions({});
  }

  function selectPhoto(photoId: string) {
    if (photoId === activePhotoId) {
      return;
    }

    setActivePhotoId(photoId);
    setResult(null);
    setReviewDecisions({});
  }

  async function runPhotoDetection(photo: SelectedPhoto) {
    updatePhoto(photo.id, (currentPhoto) => ({
      ...currentPhoto,
      detectionStatus: "RUNNING",
      error: "",
    }));

    try {
      const nextDetections = await detectPpe(photo.file);
      updatePhoto(photo.id, (currentPhoto) => ({
        ...currentPhoto,
        detectionStatus: "DONE",
        detections: nextDetections,
        excludedDetectionIndexes: [],
        error: "",
      }));
      return nextDetections;
    } catch (detectionError) {
      const message =
        detectionError instanceof Error
          ? detectionError.message
          : "图片识别失败。";

      updatePhoto(photo.id, (currentPhoto) => ({
        ...currentPhoto,
        detectionStatus: "ERROR",
        detections: [],
        excludedDetectionIndexes: [],
        error: message,
      }));
      throw detectionError;
    }
  }

  async function handleImageDetection() {
    if (activePhoto === null) {
      setError("请先选择一张施工现场图片。");
      return;
    }

    setError("");
    setBatchProgress(null);
    setDetecting(true);

    try {
      await runPhotoDetection(activePhoto);
    } catch {
      // runPhotoDetection 已经把错误保存到对应照片。
    } finally {
      setDetecting(false);
    }
  }

  async function runPendingPhotoDetections() {
    const pendingPhotos = photosRef.current.filter(
      (photo) => photo.detectionStatus !== "DONE",
    );

    if (pendingPhotos.length === 0) {
      setBatchProgress({
        completed: photosRef.current.length,
        total: photosRef.current.length,
        failed: 0,
        currentPhotoName: "",
      });
      return 0;
    }

    const total = photosRef.current.length;
    let completed = total - pendingPhotos.length;
    let failed = 0;

    setBatchProgress({
      completed,
      total,
      failed,
      currentPhotoName: pendingPhotos[0].file.name,
    });

    for (const [photoIndex, photo] of pendingPhotos.entries()) {
      setActivePhotoId(photo.id);
      setBatchProgress({
        completed,
        total,
        failed,
        currentPhotoName: photo.file.name,
      });

      try {
        await runPhotoDetection(photo);
      } catch {
        failed += 1;
      }

      completed += 1;
      setBatchProgress({
        completed,
        total,
        failed,
        currentPhotoName:
          pendingPhotos[photoIndex + 1]?.file.name ?? "",
      });
    }

    return failed;
  }

  async function handleDetectAllPhotos() {
    if (photosRef.current.length === 0) {
      setError("请先选择施工现场图片。");
      return;
    }

    setError("");
    setResult(null);
    setReviewDecisions({});
    setDetecting(true);

    try {
      await runPendingPhotoDetections();
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
      if (
        photosRef.current.some(
          (photo) => photo.detectionStatus !== "DONE",
        )
      ) {
        setDetecting(true);
        await runPendingPhotoDetections();
        setDetecting(false);
      }

      const photoEvidence = photosRef.current
        .filter((photo) => photo.detectionStatus === "DONE")
        .map((photo) => {
          const excludedIndexes = new Set(
            photo.excludedDetectionIndexes,
          );

          return {
            photoId: photo.id,
            photoName: photo.file.name,
            detections: photo.detections
              .filter(
                (_detection, index) =>
                  !excludedIndexes.has(index),
              )
              .map((detection) => ({
                label: detection.label,
                confidence: detection.confidence,
                box: detection.box,
              })),
          };
        });

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note,
          photoEvidence,
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

  function toggleDetectionInclusion(detectionIndex: number) {
    if (activePhoto === null) {
      return;
    }

    const nextExcludedIndexes = new Set(
      activePhoto.excludedDetectionIndexes,
    );

    if (nextExcludedIndexes.has(detectionIndex)) {
      nextExcludedIndexes.delete(detectionIndex);
    } else {
      nextExcludedIndexes.add(detectionIndex);
    }

    updatePhoto(activePhoto.id, (photo) => ({
      ...photo,
      excludedDetectionIndexes: [...nextExcludedIndexes],
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
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />

            <p className="mt-2 text-sm text-slate-500">
              图片只在当前浏览器中由 YOLOv8 分析，不会上传给 LLM。一次最多 10 张，每张最大 10 MB。
            </p>

            {photos.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    已选择 {photos.length} 张照片
                  </p>
                  <p className="text-sm text-slate-500">
                    检测结果按照片保存，开始分析时汇总全部照片
                  </p>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {photos.map((photo, index) => {
                    const isActive = photo.id === activePhotoId;
                    const statusLabel =
                      photo.detectionStatus === "DONE"
                        ? `已识别 ${photo.detections.length} 项`
                        : photo.detectionStatus === "RUNNING"
                          ? "识别中"
                          : photo.detectionStatus === "ERROR"
                            ? "识别失败"
                            : "未识别";

                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => selectPhoto(photo.id)}
                        aria-pressed={isActive}
                        disabled={detecting}
                        className={`rounded-lg border px-3 py-3 text-left transition ${
                          isActive
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                          <span>
                            照片 {index + 1}
                            {isActive ? " · 当前" : ""}
                          </span>
                          <span className="text-xs font-medium opacity-70">
                            {statusLabel}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs opacity-75">
                          {photo.file.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {previewUrl.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-2">
                <canvas
                  ref={canvasRef}
                  className="h-auto max-h-[640px] w-full object-contain"
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleImageDetection}
                disabled={detecting || imageFile === null}
                className="rounded-xl border border-blue-600 px-5 py-2.5 font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {detecting && !isBatchDetecting
                  ? "正在加载模型并识别……"
                  : "识别当前照片"}
              </button>

              <button
                type="button"
                onClick={handleDetectAllPhotos}
                disabled={
                  detecting || photos.length === 0 || allPhotosDetected
                }
                className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBatchDetecting && batchProgress !== null
                  ? `批量识别 ${batchProgress.completed}/${batchProgress.total}`
                  : allPhotosDetected
                    ? "全部照片已识别"
                    : "识别全部照片"}
              </button>
            </div>

            {batchProgress !== null && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-semibold text-blue-900">
                    批量识别：{batchProgress.completed}/
                    {batchProgress.total}
                  </p>
                  <p className="text-blue-700">
                    {batchProgress.currentPhotoName.length > 0
                      ? `正在识别：${batchProgress.currentPhotoName}`
                      : batchProgress.failed > 0
                        ? `已完成，失败 ${batchProgress.failed} 张`
                        : "全部完成"}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${
                        (batchProgress.completed /
                          batchProgress.total) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {visionError.length > 0 && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {visionError}
              </p>
            )}

            {hasDetected && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-800">
                  当前照片的视觉检测结果
                </p>

                {detections.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    当前阈值下未检测到模型支持的目标，请人工检查照片。
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-slate-500">
                      取消勾选误检项目后，这些项目不会发送给 LLM。
                    </p>

                    <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      {detections.map((detection, index) => (
                        <li
                          key={`${detection.label}-${index}`}
                          className="rounded-lg bg-white px-3 py-2"
                        >
                          <label className="flex cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={
                                !excludedDetectionIndexes.includes(index)
                              }
                              onChange={() =>
                                toggleDetectionInclusion(index)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            <span
                              className={
                                excludedDetectionIndexes.includes(index)
                                  ? "text-slate-400 line-through"
                                  : ""
                              }
                            >
                              {ppeLabels[detection.label]} ·{" "}
                              {Math.round(detection.confidence * 100)}%
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
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
                          证据来源
                        </dt>
                        <dd className="mt-2 flex flex-wrap gap-2">
                          {finding.evidence_photos.length > 0 ? (
                            finding.evidence_photos.map((photoName) => (
                              <span
                                key={photoName}
                                className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                              >
                                {photoName}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-800">
                              巡检备注
                            </span>
                          )}
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
