"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { InspectionAnalysis } from "@/lib/schemas";
import {
  FindingEditor,
  type FindingEditorValue,
} from "@/components/finding-editor";
import { CloudSubmission } from "@/components/cloud-submission";
import { InspectionHistory } from "@/components/inspection-history";
import { ProductShell } from "@/components/product-shell";
import { ReportDownload } from "@/components/report-download";
import { useLanguage } from "@/components/language-provider";
import {
  loadCloudProjects,
  submitInspectionToCloud,
  type CloudSubmissionStage,
} from "@/lib/cloud-inspection";
import type { CloudProject } from "@/lib/cloud-inspection-schema";
import {
  deleteInspectionRecord,
  listInspectionRecords,
  saveInspectionRecord,
  type StoredInspectionRecord,
} from "@/lib/inspection-store";
import { detectPpe, type VisionDetection } from "@/lib/vision";
import { createClient } from "@/lib/supabase/client";
import { categoryLabel, detectionLabel, riskLabel } from "@/lib/i18n";

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

const riskStyles: Record<Finding["risk_level"], string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
  UNCONFIRMED: "bg-slate-200 text-slate-700",
};

const EMPTY_DETECTIONS: VisionDetection[] = [];
const EMPTY_EXCLUDED_INDEXES: number[] = [];

function getDetectionId(photoId: string, detectionIndex: number) {
  return `${photoId}::${detectionIndex}`;
}

const EMPTY_FINDING: FindingEditorValue = {
  category: "BLOCKED_ACCESS",
  title: "",
  description: "",
  visible_evidence: "",
  evidence_photos: [],
  evidence_detection_ids: [],
  risk_level: "UNCONFIRMED",
  corrective_action: "",
  uncertainty: [],
};

export default function Home() {
  const { locale, t } = useLanguage();
  const l = useCallback(
    (zh: string, en: string) => (locale === "zh" ? zh : en),
    [locale],
  );
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<
    Record<string, ReviewDecision>
  >({});
  const [historyRecords, setHistoryRecords] = useState<
    StoredInspectionRecord[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyBusyRecordId, setHistoryBusyRecordId] = useState<
    string | null
  >(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [cloudProjectsLoading, setCloudProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const [submittedInspectionId, setSubmittedInspectionId] = useState("");
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(
    null,
  );
  const [currentRecordCreatedAt, setCurrentRecordCreatedAt] = useState<
    string | null
  >(null);
  const [editingFindingId, setEditingFindingId] = useState<string | null>(
    null,
  );
  const [isAddingFinding, setIsAddingFinding] = useState(false);
  const [pendingDeleteFindingId, setPendingDeleteFindingId] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [batchProgress, setBatchProgress] =
    useState<BatchDetectionProgress | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const [highlightedDetectionIds, setHighlightedDetectionIds] = useState<
    string[]
  >([]);
  const [evidenceNavigationMessage, setEvidenceNavigationMessage] =
    useState("");
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
  const findingReviewCounts = (result?.analysis.findings ?? []).reduce(
    (counts, finding) => {
      const decision = reviewDecisions[finding.id] ?? "PENDING";
      counts[decision] += 1;
      return counts;
    },
    { PENDING: 0, APPROVED: 0, REJECTED: 0 },
  );
  const canSubmitToCloud =
    result !== null &&
    photos.length > 0 &&
    selectedProjectId.length > 0 &&
    findingReviewCounts.PENDING === 0 &&
    submittedInspectionId.length === 0;

  function closeFindingEditor() {
    setEditingFindingId(null);
    setIsAddingFinding(false);
    setPendingDeleteFindingId(null);
  }

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data, error: authError }) => {
        if (authError || !data.user) {
          throw new Error(l("无法确认当前账号，本地巡检历史暂不可用。", "Your account could not be verified. Local history is unavailable."));
        }

        if (!cancelled) {
          setCurrentUserId(data.user.id);
        }

        return listInspectionRecords(data.user.id);
      })
      .then((records) => {
        if (!cancelled) {
          setHistoryRecords(records);
        }
      })
      .catch((historyError: unknown) => {
        if (!cancelled) {
          setHistoryMessage(
            historyError instanceof Error
              ? historyError.message
              : l("无法读取本地巡检历史。", "Unable to load local inspection history."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [l]);

  useEffect(() => {
    let cancelled = false;

    loadCloudProjects()
      .then((projects) => {
        if (cancelled) {
          return;
        }

        setCloudProjects(projects);
        setSelectedProjectId((currentProjectId) =>
          projects.some((project) => project.id === currentProjectId)
            ? currentProjectId
            : (projects[0]?.id ?? ""),
        );
      })
      .catch((projectError: unknown) => {
        if (!cancelled) {
          setCloudMessage(
            projectError instanceof Error
              ? projectError.message
              : l("无法读取云端项目。", "Unable to load cloud projects."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCloudProjectsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [l]);

  async function handleSaveInspection() {
    if (result === null) {
      setHistoryMessage(l("请先完成一次巡检分析。", "Complete an inspection analysis first."));
      return;
    }

    if (!currentUserId) {
      setHistoryMessage(l("无法确认当前账号，本地巡检历史暂不可用。", "Your account could not be verified. Local history is unavailable."));
      return;
    }

    const now = new Date().toISOString();
    const recordId = currentRecordId ?? crypto.randomUUID();
    const createdAt = currentRecordCreatedAt ?? now;
    const location = result.analysis.location.trim();
    const title =
      location.length > 0 && location !== "未提供" && location !== "Not provided"
        ? location
        : note.trim().slice(0, 30) || l("未命名巡检", "Untitled inspection");
    const record: StoredInspectionRecord = {
      version: 2,
      ownerId: currentUserId,
      id: recordId,
      title,
      createdAt,
      updatedAt: now,
      note,
      analysis: result.analysis,
      reviewDecisions,
      activePhotoId,
      photos: photosRef.current.map((photo) => ({
        id: photo.id,
        fileName: photo.file.name,
        fileType: photo.file.type,
        fileLastModified: photo.file.lastModified,
        blob: photo.file,
        detectionStatus: photo.detectionStatus,
        detections: photo.detections,
        excludedDetectionIndexes: photo.excludedDetectionIndexes,
        error: photo.error,
      })),
    };

    setHistoryBusyRecordId("SAVE");
    setHistoryMessage("");

    try {
      await saveInspectionRecord(record);
      const records = await listInspectionRecords(currentUserId);
      setHistoryRecords(records);
      setCurrentRecordId(recordId);
      setCurrentRecordCreatedAt(createdAt);
      setHistoryMessage(
        currentRecordId === null
          ? l("巡检记录已保存到当前浏览器。", "Inspection saved in this browser.")
          : l("当前巡检记录已更新。", "Current inspection updated."),
      );
    } catch (historyError) {
      setHistoryMessage(
        historyError instanceof Error
          ? historyError.message
          : l("保存巡检记录失败，浏览器存储空间可能不足。", "Unable to save the inspection. Browser storage may be full."),
      );
    } finally {
      setHistoryBusyRecordId(null);
    }
  }

  async function handleCloudSubmit() {
    if (result === null || selectedProjectId.length === 0) {
      setCloudMessage(l("请先完成分析并选择所属项目。", "Complete the analysis and select a project first."));
      return;
    }

    setCloudBusy(true);
    setCloudMessage("");

    const updateCloudProgress = (
      stage: CloudSubmissionStage,
      completed: number,
      total: number,
    ) => {
      if (stage === "CREATING_DRAFT") {
        setCloudMessage(l("正在创建受保护的云端草稿……", "Creating a protected cloud draft…"));
      } else if (stage === "UPLOADING_PHOTOS") {
        setCloudMessage(l(`正在上传私有照片 ${completed + 1}/${total}……`, `Uploading private photo ${completed + 1}/${total}…`));
      } else if (stage === "SUBMITTING_DATA") {
        setCloudMessage(l("照片上传完成，正在执行数据库事务……", "Photos uploaded. Saving the database transaction…"));
      } else {
        setCloudMessage(l("提交未完成，正在清理云端草稿和照片……", "Submission was not completed. Cleaning up the cloud draft and photos…"));
      }
    };

    try {
      const submission = await submitInspectionToCloud({
        projectId: selectedProjectId,
        note,
        analysis: result.analysis,
        reviewDecisions,
        photos: photosRef.current,
        onProgress: updateCloudProgress,
      });

      setSubmittedInspectionId(submission.inspectionId);
      setCloudMessage(
        l(
          `正式提交成功：已保存 ${photosRef.current.length} 张照片和 ${submission.findingCount} 条已批准问题。`,
          `Official submission complete: ${photosRef.current.length} photos and ${submission.findingCount} approved findings saved.`,
        ),
      );
    } catch (submissionError) {
      setCloudMessage(
        submissionError instanceof Error
          ? submissionError.message
          : l("云端提交失败。", "Cloud submission failed."),
      );
    } finally {
      setCloudBusy(false);
    }
  }

  function handleLoadInspection(record: StoredInspectionRecord) {
    setHistoryBusyRecordId(record.id);
    setHistoryMessage("");

    try {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }

      const restoredPhotos: SelectedPhoto[] = record.photos.map((photo) => {
        const file = new File([photo.blob], photo.fileName, {
          type: photo.fileType,
          lastModified: photo.fileLastModified,
        });

        return {
          id: photo.id,
          file,
          previewUrl: URL.createObjectURL(file),
          detectionStatus:
            photo.detectionStatus === "RUNNING"
              ? "IDLE"
              : photo.detectionStatus,
          detections: photo.detections,
          excludedDetectionIndexes: photo.excludedDetectionIndexes,
          error: photo.error,
        };
      });

      photosRef.current = restoredPhotos;
      setPhotos(restoredPhotos);
      setActivePhotoId(
        restoredPhotos.some((photo) => photo.id === record.activePhotoId)
          ? record.activePhotoId
          : (restoredPhotos[0]?.id ?? ""),
      );
      setNote(record.note);
      setResult({ analysis: record.analysis, reviewed: false });
      setReviewDecisions(record.reviewDecisions);
      setCurrentRecordId(record.id);
      setCurrentRecordCreatedAt(record.createdAt);
      setBatchProgress(null);
      setError("");
      setHighlightedDetectionIds([]);
      setEvidenceNavigationMessage("");
      setSubmittedInspectionId("");
      setCloudMessage("");
      closeFindingEditor();
      setHistoryMessage(l("已载入巡检记录及其照片和审核状态。", "Inspection, photos and review status loaded."));
    } catch (historyError) {
      setHistoryMessage(
        historyError instanceof Error
          ? historyError.message
          : l("载入巡检记录失败。", "Unable to load the inspection."),
      );
    } finally {
      setHistoryBusyRecordId(null);
    }
  }

  async function handleDeleteInspection(recordId: string) {
    setHistoryBusyRecordId(recordId);
    setHistoryMessage("");

    try {
      if (!currentUserId) {
        throw new Error(l("无法确认当前账号，本地巡检历史暂不可用。", "Your account could not be verified. Local history is unavailable."));
      }
      await deleteInspectionRecord(recordId, currentUserId);
      setHistoryRecords((records) =>
        records.filter((record) => record.id !== recordId),
      );

      if (currentRecordId === recordId) {
        setCurrentRecordId(null);
        setCurrentRecordCreatedAt(null);
      }

      setHistoryMessage(l("本地巡检记录已删除。当前页面内容未被清空。", "Local inspection deleted. The current page has not been cleared."));
    } catch (historyError) {
      setHistoryMessage(
        historyError instanceof Error
          ? historyError.message
          : l("删除本地巡检记录失败。", "Unable to delete the local inspection."),
      );
    } finally {
      setHistoryBusyRecordId(null);
    }
  }

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

      for (const [detectionIndex, detection] of detections.entries()) {
        const isViolation = detection.label.startsWith("NO-");
        const color = isViolation ? "#dc2626" : "#2563eb";
        const isHighlighted =
          activePhotoId.length > 0 &&
          highlightedDetectionIds.includes(
            getDetectionId(activePhotoId, detectionIndex),
          );
        const label = `${detectionLabel(locale, detection.label)} ${Math.round(
          detection.confidence * 100,
        )}%`;
        const textWidth = context.measureText(label).width;
        const labelHeight = fontSize + 10;
        const labelY = Math.max(0, detection.box.y - labelHeight);

        if (isHighlighted) {
          context.save();
          context.strokeStyle = "#facc15";
          context.lineWidth = lineWidth * 4;
          context.shadowColor = "#facc15";
          context.shadowBlur = lineWidth * 8;
          context.strokeRect(
            detection.box.x,
            detection.box.y,
            detection.box.width,
            detection.box.height,
          );
          context.restore();
        }

        context.lineWidth = isHighlighted ? lineWidth * 2 : lineWidth;
        context.strokeStyle = isHighlighted ? "#facc15" : color;
        context.strokeRect(
          detection.box.x,
          detection.box.y,
          detection.box.width,
          detection.box.height,
        );
        context.fillStyle = isHighlighted ? "#ca8a04" : color;
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
  }, [activePhotoId, detections, highlightedDetectionIds, locale, previewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.length > 10) {
      event.target.value = "";
      setError(l("一次最多选择 10 张图片。", "Select no more than 10 images."));
      return;
    }

    if (selectedFiles.some((file) => !file.type.startsWith("image/"))) {
      event.target.value = "";
      setError(l("请选择 JPEG、PNG 或 WebP 图片。", "Select JPEG, PNG or WebP images."));
      return;
    }

    if (selectedFiles.some((file) => file.size > 10 * 1024 * 1024)) {
      event.target.value = "";
      setError(l("每张图片不能超过 10 MB。", "Each image must be 10 MB or smaller."));
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
    setCurrentRecordId(null);
    setCurrentRecordCreatedAt(null);
    setHighlightedDetectionIds([]);
    setEvidenceNavigationMessage("");
    setSubmittedInspectionId("");
    setCloudMessage("");
    closeFindingEditor();
  }

  function selectPhoto(photoId: string) {
    if (photoId === activePhotoId) {
      return;
    }

    setActivePhotoId(photoId);
    setHighlightedDetectionIds([]);
    setEvidenceNavigationMessage("");
  }

  function showFindingEvidence(
    photoName: string,
    evidenceDetectionIds: string[],
  ) {
    const photo =
      photosRef.current.find((currentPhoto) =>
        evidenceDetectionIds.some((detectionId) =>
          detectionId.startsWith(`${currentPhoto.id}::`),
        ),
      ) ??
      photosRef.current.find(
        (currentPhoto) => currentPhoto.file.name === photoName,
      );

    if (photo === undefined) {
      setEvidenceNavigationMessage(
        l(`找不到证据照片“${photoName}”，它可能已被替换。`, `Evidence photo “${photoName}” was not found and may have been replaced.`),
      );
      return;
    }

    const photoDetectionIdPrefix = `${photo.id}::`;
    const matchingDetectionIds = evidenceDetectionIds.filter(
      (detectionId) => detectionId.startsWith(photoDetectionIdPrefix),
    );

    setActivePhotoId(photo.id);
    setHighlightedDetectionIds(matchingDetectionIds);
    setEvidenceNavigationMessage(
      matchingDetectionIds.length > 0
        ? l(`已切换到“${photoName}”，并高亮 ${matchingDetectionIds.length} 个证据框。`, `Showing “${photoName}” with ${matchingDetectionIds.length} evidence boxes highlighted.`)
        : l(`已切换到“${photoName}”。该 finding 没有精确的检测框引用，请人工查看整张照片。`, `Showing “${photoName}”. This finding has no exact detection-box reference; review the full photo manually.`),
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        previewSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });
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
          : l("图片识别失败。", "Image detection failed.");

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
      setError(l("请先选择一张施工现场图片。", "Select a construction site image first."));
      return;
    }

    setError("");
    setBatchProgress(null);
    setResult(null);
    setReviewDecisions({});
    setHighlightedDetectionIds([]);
    setEvidenceNavigationMessage("");
    setSubmittedInspectionId("");
    closeFindingEditor();
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
      setError(l("请先选择施工现场图片。", "Select construction site images first."));
      return;
    }

    setError("");
    setResult(null);
    setReviewDecisions({});
    setHighlightedDetectionIds([]);
    setEvidenceNavigationMessage("");
    setSubmittedInspectionId("");
    closeFindingEditor();
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
    setHighlightedDetectionIds([]);
    setEvidenceNavigationMessage("");
    setSubmittedInspectionId("");
    closeFindingEditor();

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
            detections: photo.detections.flatMap(
              (detection, detectionIndex) =>
                excludedIndexes.has(detectionIndex)
                  ? []
                  : [
                      {
                        detectionId: getDetectionId(
                          photo.id,
                          detectionIndex,
                        ),
                        label: detection.label,
                        confidence: detection.confidence,
                        box: detection.box,
                      },
                    ],
            ),
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
          locale,
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
            l("巡检分析失败", "Inspection analysis failed"),
        );
      }

      setResult(data as AnalyzeResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : l("发生未知错误", "An unknown error occurred"),
      );
    } finally {
      setDetecting(false);
      setLoading(false);
    }
  }

  function updateReviewDecision(
    findingId: string,
    decision: ReviewDecision,
  ) {
    setSubmittedInspectionId("");
    setReviewDecisions((currentDecisions) => ({
      ...currentDecisions,
      [findingId]: decision,
    }));
  }

  function resetFindingDecision(findingId: string) {
    setReviewDecisions((currentDecisions) => {
      const nextDecisions = { ...currentDecisions };
      delete nextDecisions[findingId];
      return nextDecisions;
    });
  }

  function addFinding(value: FindingEditorValue) {
    setSubmittedInspectionId("");
    const finding: Finding = {
      ...value,
      id: crypto.randomUUID(),
      origin: "HUMAN",
      modified_by_human: true,
      status: "HUMAN_DRAFT",
      requires_human_review: true,
    };

    setResult((currentResult) =>
      currentResult === null
        ? currentResult
        : {
            ...currentResult,
            analysis: {
              ...currentResult.analysis,
              findings: [...currentResult.analysis.findings, finding],
            },
          },
    );
    closeFindingEditor();
  }

  function updateFinding(
    findingId: string,
    value: FindingEditorValue,
  ) {
    setSubmittedInspectionId("");
    setResult((currentResult) =>
      currentResult === null
        ? currentResult
        : {
            ...currentResult,
            analysis: {
              ...currentResult.analysis,
              findings: currentResult.analysis.findings.map((finding) =>
                finding.id === findingId
                  ? {
                      ...finding,
                      ...value,
                      evidence_detection_ids:
                        (finding.evidence_detection_ids ?? []).filter(
                          (detectionId) =>
                            photosRef.current.some(
                              (photo) =>
                                value.evidence_photos.includes(
                                  photo.file.name,
                                ) &&
                                detectionId.startsWith(`${photo.id}::`),
                            ),
                        ),
                      modified_by_human: true,
                    }
                  : finding,
              ),
            },
          },
    );
    resetFindingDecision(findingId);
    closeFindingEditor();
  }

  function deleteFinding(findingId: string) {
    setSubmittedInspectionId("");
    setResult((currentResult) =>
      currentResult === null
        ? currentResult
        : {
            ...currentResult,
            analysis: {
              ...currentResult.analysis,
              findings: currentResult.analysis.findings.filter(
                (finding) => finding.id !== findingId,
              ),
            },
          },
    );
    resetFindingDecision(findingId);
    closeFindingEditor();
  }

  function toggleDetectionInclusion(detectionIndex: number) {
    if (activePhoto === null) {
      return;
    }

    setSubmittedInspectionId("");

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
    <ProductShell pageLabel={t("inspection.pageLabel")} title={t("inspection.pageTitle")}>
      <main id="workspace" className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1440px]">
          <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                <span className="h-px w-8 bg-amber-500" />
                Smart site safety
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {t("inspection.heroTitle")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {t("inspection.heroDescription")}
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t("inspection.visionReady")}
            </div>
          </header>

          <section aria-label={t("inspection.progressLabel")} className="mt-7 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">1</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{t("inspection.stepUpload")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{photos.length} {t("common.photoCount")} · {photos.filter((photo) => photo.detectionStatus === "DONE").length} {locale === "zh" ? "张已识别" : "analysed"}</p>
                </div>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 shadow-sm ${result === null ? "border-slate-200 bg-white" : "border-violet-200 bg-violet-50/70"}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${result === null ? "bg-slate-100 text-slate-500" : "bg-violet-600 text-white"}`}>2</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{t("inspection.stepAnalysis")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{result?.analysis.findings.length ?? 0} {t("common.findingCount")} · {findingReviewCounts.APPROVED} {t("submission.approved")}</p>
                </div>
              </div>
            </div>
            <div className={`rounded-2xl border p-4 shadow-sm ${submittedInspectionId ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${submittedInspectionId ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>3</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{t("inspection.stepSubmit")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{submittedInspectionId ? t("inspection.savedCloud") : t("inspection.waitingReview")}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Step 01</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{t("inspection.captureTitle")}</h2>
                </div>
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">{t("inspection.browserOnly")}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-7">
          <fieldset>
            <legend className="font-semibold text-slate-800">
              {t("inspection.sitePhotos")}
            </legend>

            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />

            <p className="mt-2 text-sm text-slate-500">
              {t("inspection.photoHelp")}
            </p>

            {photos.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    {t("inspection.selectedPhotos")} {photos.length} {t("common.photoCount")}
                  </p>
                  <p className="text-sm text-slate-500">
                    {t("inspection.resultsGrouped")}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {photos.map((photo, index) => {
                    const isActive = photo.id === activePhotoId;
                    const statusLabel =
                      photo.detectionStatus === "DONE"
                        ? `${locale === "zh" ? "已识别" : "Detected"} ${photo.detections.length}`
                        : photo.detectionStatus === "RUNNING"
                          ? t("inspection.detecting")
                          : photo.detectionStatus === "ERROR"
                            ? t("inspection.detectFailed")
                            : t("inspection.notDetected");

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
                            {locale === "zh" ? "照片" : "Photo"} {index + 1}
                            {isActive ? ` · ${t("inspection.current")}` : ""}
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
              <div ref={previewSectionRef} className="mt-4">
                {evidenceNavigationMessage.length > 0 && (
                  <p className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-900">
                    {evidenceNavigationMessage}
                  </p>
                )}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-2">
                  <canvas
                    ref={canvasRef}
                    className="h-auto max-h-[640px] w-full object-contain"
                  />
                </div>
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
                  ? t("inspection.detectCurrentBusy")
                  : t("inspection.detectCurrent")}
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
                  ? `${l("批量识别", "Batch detection")} ${batchProgress.completed}/${batchProgress.total}`
                  : allPhotosDetected
                    ? t("inspection.allDetected")
                    : t("inspection.detectAll")}
              </button>
            </div>

            {batchProgress !== null && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-semibold text-blue-900">
                    {l("批量识别", "Batch detection")}：{batchProgress.completed}/
                    {batchProgress.total}
                  </p>
                  <p className="text-blue-700">
                    {batchProgress.currentPhotoName.length > 0
                      ? `${l("正在识别", "Detecting")}：${batchProgress.currentPhotoName}`
                      : batchProgress.failed > 0
                        ? l(`已完成，失败 ${batchProgress.failed} 张`, `Complete, ${batchProgress.failed} failed`)
                        : t("inspection.batchComplete")}
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
                  {t("inspection.currentDetections")}
                </p>

                {detections.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {t("inspection.noDetections")}
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-slate-500">
                      {t("inspection.excludeHint")}
                    </p>

                    <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      {detections.map((detection, index) => (
                        <li
                          key={`${detection.label}-${index}`}
                          className={`rounded-lg px-3 py-2 transition ${
                            activePhoto !== null &&
                            highlightedDetectionIds.includes(
                              getDetectionId(activePhoto.id, index),
                            )
                              ? "bg-yellow-100 ring-2 ring-yellow-400"
                              : "bg-white"
                          }`}
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
                              {detectionLabel(locale, detection.label)} ·{" "}
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
            {t("inspection.note")}
          </label>

          <textarea
            id="inspection-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setSubmittedInspectionId("");
            }}
            rows={7}
            placeholder={t("inspection.notePlaceholder")}
            className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="submit"
            disabled={loading || detecting || note.trim().length < 3}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {detecting
              ? t("inspection.analyzingPhotos")
              : loading
                ? t("inspection.analyzingAi")
                : t("inspection.startAnalysis")}
          </button>
            </form>
          </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">{t("inspection.analysisFailed")}</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {result !== null && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">
                {t("inspection.draftTitle")}
              </h2>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                {t("inspection.awaitingHuman")}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              {t("inspection.aiDisclaimer")}
            </p>

            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{t("inspection.reportTitle")}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {t("inspection.reportDescription")}
                </p>
              </div>
              <ReportDownload
                note={note}
                analysis={result.analysis}
                reviewDecisions={reviewDecisions}
                photos={photos}
                projectId={selectedProjectId || undefined}
                inspectionId={submittedInspectionId || undefined}
                projectName={
                  cloudProjects.find(
                    (project) => project.id === selectedProjectId,
                  )?.name ?? ""
                }
                disabled={findingReviewCounts.PENDING > 0}
              />
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">
                {t("inspection.location")}
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {result.analysis.location}
              </p>

              <p className="mt-4 text-sm font-medium text-slate-500">
                {t("inspection.summary")}
              </p>
              <p className="mt-1 text-slate-800">
                {result.analysis.summary}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {result.analysis.findings.length} {t("common.findingCount")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsAddingFinding(true);
                  setEditingFindingId(null);
                  setPendingDeleteFindingId(null);
                }}
                disabled={isAddingFinding}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("inspection.addFinding")}
              </button>
            </div>

            {isAddingFinding && (
              <div className="mt-5">
                <h3 className="mb-3 font-semibold text-slate-900">
                  {t("inspection.addFindingTitle")}
                </h3>
                <FindingEditor
                  key="new-finding"
                  initialValue={EMPTY_FINDING}
                  photoNames={photos.map((photo) => photo.file.name)}
                  submitLabel={t("inspection.saveNew")}
                  onSave={addFinding}
                  onCancel={closeFindingEditor}
                />
              </div>
            )}

            {result.analysis.findings.length === 0 && !isAddingFinding ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                {t("inspection.noFindings")}
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {result.analysis.findings.map((finding, index) =>
                  editingFindingId === finding.id ? (
                    <div key={finding.id}>
                      <h3 className="mb-3 font-semibold text-slate-900">
                        {t("inspection.editFinding")} {index + 1}
                      </h3>
                      <FindingEditor
                        initialValue={{
                          ...finding,
                          evidence_detection_ids:
                            finding.evidence_detection_ids ?? [],
                        }}
                        photoNames={photos.map((photo) => photo.file.name)}
                        submitLabel={t("inspection.saveEdit")}
                        onSave={(value) => updateFinding(finding.id, value)}
                        onCancel={closeFindingEditor}
                      />
                    </div>
                  ) : (
                  <article
                    key={finding.id}
                    className="rounded-xl border border-slate-200 p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-blue-600">
                          {t("inspection.finding")} {index + 1} ·{" "}
                          {categoryLabel(locale, finding.category)}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {finding.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {finding.origin === "HUMAN"
                              ? t("inspection.manual")
                              : t("inspection.aiGenerated")}
                          </span>
                          {finding.modified_by_human &&
                            finding.origin === "AI" && (
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                                {t("inspection.modified")}
                              </span>
                            )}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          riskStyles[finding.risk_level]
                        }`}
                      >
                        {riskLabel(locale, finding.risk_level)}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-4">
                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          {t("editor.description")}
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.description}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          {t("editor.visibleEvidence")}
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.visible_evidence}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          {t("inspection.evidenceSource")}
                        </dt>
                        <dd className="mt-2 flex flex-wrap gap-2">
                          {finding.evidence_photos.length > 0 ? (
                            finding.evidence_photos.map((photoName) => (
                              <button
                                type="button"
                                key={photoName}
                                onClick={() =>
                                  showFindingEvidence(
                                    photoName,
                                    finding.evidence_detection_ids ?? [],
                                  )
                                }
                                className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title={t("inspection.viewPhoto")}
                              >
                                {t("inspection.viewPhoto")}：{photoName}
                              </button>
                            ))
                          ) : (
                            <span className="text-slate-800">
                              {t("inspection.note")}
                            </span>
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          {t("editor.correctiveAction")}
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.corrective_action}
                        </dd>
                      </div>
                    </dl>

                    {finding.uncertainty.length > 0 && (
                      <div className="mt-5 rounded-lg bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">
                          {t("inspection.awaitingHuman")}
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
                        {t("inspection.reviewStatus")}：
                        {reviewDecisions[finding.id] === "APPROVED"
                          ? t("inspection.statusApproved")
                          : reviewDecisions[finding.id] === "REJECTED"
                            ? t("inspection.statusRejected")
                            : t("inspection.statusPending")}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {pendingDeleteFindingId === finding.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteFindingId(null)}
                              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t("inspection.undoDelete")}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteFinding(finding.id)}
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                            >
                              {t("common.confirmDelete")}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingDeleteFindingId(finding.id);
                                setEditingFindingId(null);
                              }}
                              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t("common.delete")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFindingId(finding.id);
                                setIsAddingFinding(false);
                                setPendingDeleteFindingId(null);
                              }}
                              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              {t("common.edit")}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            updateReviewDecision(
                              finding.id,
                              "REJECTED",
                            )
                          }
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            reviewDecisions[finding.id] === "REJECTED"
                              ? "border-red-600 bg-red-600 text-white"
                              : "border-red-200 text-red-700 hover:bg-red-50"
                          }`}
                        >
                          {t("inspection.reject")}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateReviewDecision(
                              finding.id,
                              "APPROVED",
                            )
                          }
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            reviewDecisions[finding.id] === "APPROVED"
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {t("inspection.approve")}
                        </button>
                      </div>
                    </div>
                  </article>
                  ),
                )}
              </div>
            )}
          </section>
        )}

          <section id="records" className="mt-6 grid gap-6 xl:grid-cols-2">
            <InspectionHistory
              records={historyRecords}
              currentRecordId={currentRecordId}
              canSave={result !== null}
              loading={historyLoading}
              busyRecordId={historyBusyRecordId}
              message={historyMessage}
              onSave={handleSaveInspection}
              onLoad={handleLoadInspection}
              onDelete={handleDeleteInspection}
            />

            <CloudSubmission
              projects={cloudProjects}
              selectedProjectId={selectedProjectId}
              projectsLoading={cloudProjectsLoading}
              busy={cloudBusy}
              canSubmit={canSubmitToCloud}
              pendingFindings={findingReviewCounts.PENDING}
              approvedFindings={findingReviewCounts.APPROVED}
              rejectedFindings={findingReviewCounts.REJECTED}
              message={cloudMessage}
              submittedInspectionId={submittedInspectionId}
              onProjectChange={setSelectedProjectId}
              onSubmit={handleCloudSubmit}
            />
          </section>
        </div>
      </main>
    </ProductShell>
  );
}
