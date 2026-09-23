"use client";

import type { InspectionAnalysis } from "@/lib/schemas";
import {
  CloudInspectionPayloadSchema,
  type CloudInspectionPayload,
  type CloudProject,
} from "@/lib/cloud-inspection-schema";
import { createClient } from "@/lib/supabase/client";
import type { VisionDetection } from "@/lib/vision";

export type CloudSubmissionPhoto = {
  id: string;
  file: File;
  detections: VisionDetection[];
  excludedDetectionIndexes: number[];
};

export type CloudSubmissionStage =
  | "CREATING_DRAFT"
  | "UPLOADING_PHOTOS"
  | "SUBMITTING_DATA"
  | "CLEANING_UP";

type ReviewDecision = "PENDING" | "APPROVED" | "REJECTED";

type SubmitInspectionOptions = {
  projectId: string;
  note: string;
  analysis: InspectionAnalysis;
  reviewDecisions: Record<string, ReviewDecision>;
  photos: CloudSubmissionPhoto[];
  onProgress?: (
    stage: CloudSubmissionStage,
    completed: number,
    total: number,
  ) => void;
};

type ApiErrorBody = {
  error?: string;
};

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

async function getImageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);

  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

async function getSha256(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function getExtension(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  throw new Error("云端提交仅支持 JPEG、PNG 和 WebP 图片。");
}

export async function loadCloudProjects(): Promise<CloudProject[]> {
  const response = await fetch("/api/projects", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "无法读取可用项目。"),
    );
  }

  const body = (await response.json()) as { projects?: CloudProject[] };
  return body.projects ?? [];
}

export async function submitInspectionToCloud({
  projectId,
  note,
  analysis,
  reviewDecisions,
  photos,
  onProgress,
}: SubmitInspectionOptions) {
  if (photos.length === 0) {
    throw new Error("请至少选择一张巡检照片。 ");
  }

  if (
    analysis.findings.some(
      (finding) =>
        (reviewDecisions[finding.id] ?? "PENDING") === "PENDING",
    )
  ) {
    throw new Error("提交前请批准或驳回每一条 finding。 ");
  }

  for (const photo of photos) {
    getExtension(photo.file.type);

    if (photo.file.name.length > 255) {
      throw new Error(`照片文件名过长：${photo.file.name}`);
    }
  }

  let inspectionId = "";

  try {
    onProgress?.("CREATING_DRAFT", 0, photos.length);
    const draftResponse = await fetch("/api/inspections/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        location: analysis.location,
        note,
        summary: analysis.summary,
      }),
    });

    if (!draftResponse.ok) {
      throw new Error(
        await readApiError(draftResponse, "无法创建云端巡检草稿。"),
      );
    }

    const draft = (await draftResponse.json()) as {
      inspectionId: string;
    };
    inspectionId = draft.inspectionId;

    const supabase = createClient();
    const cloudPhotos: CloudInspectionPayload["photos"] = [];
    const photoLookup = new Map<
      string,
      { databaseId: string; fileName: string }
    >();
    const detectionLookup = new Map<
      string,
      { databaseId: string; photoId: string; excluded: boolean }
    >();

    for (const [photoIndex, photo] of photos.entries()) {
      onProgress?.(
        "UPLOADING_PHOTOS",
        photoIndex,
        photos.length,
      );

      const databaseId = crypto.randomUUID();
      const storageKey = `${projectId}/${inspectionId}/photos/${databaseId}.${getExtension(photo.file.type)}`;
      const [{ width, height }, sha256] = await Promise.all([
        getImageDimensions(photo.file),
        getSha256(photo.file),
      ]);
      const excludedIndexes = new Set(photo.excludedDetectionIndexes);
      const detections = photo.detections.map((detection, index) => {
        const detectionId = crypto.randomUUID();
        const clientDetectionId = `${photo.id}::${index}`;
        const excluded = excludedIndexes.has(index);

        detectionLookup.set(clientDetectionId, {
          databaseId: detectionId,
          photoId: databaseId,
          excluded,
        });

        return {
          id: detectionId,
          client_detection_id: clientDetectionId,
          model_name: "construction-ppe-yolov8n",
          model_version: "local-onnx-v1",
          label: detection.label,
          confidence: detection.confidence,
          box_x: detection.box.x,
          box_y: detection.box.y,
          box_width: detection.box.width,
          box_height: detection.box.height,
          excluded_by_user: excluded,
        };
      });

      const { error: uploadError } = await supabase.storage
        .from("inspection-photos")
        .upload(storageKey, photo.file, {
          contentType: photo.file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`上传“${photo.file.name}”失败：${uploadError.message}`);
      }

      cloudPhotos.push({
        id: databaseId,
        storage_key: storageKey,
        original_file_name: photo.file.name,
        mime_type: photo.file.type as "image/jpeg" | "image/png" | "image/webp",
        size_bytes: photo.file.size,
        width,
        height,
        sha256,
        detections,
      });
      photoLookup.set(photo.id, {
        databaseId,
        fileName: photo.file.name,
      });
    }

    const approvedFindings = analysis.findings.filter(
      (finding) => reviewDecisions[finding.id] === "APPROVED",
    );
    const cloudFindings: CloudInspectionPayload["findings"] =
      approvedFindings.map((finding) => {
        const evidence = new Map<
          string,
          { photo_id: string; detection_id: string | null }
        >();

        for (const clientDetectionId of finding.evidence_detection_ids) {
          const detection = detectionLookup.get(clientDetectionId);

          if (detection && !detection.excluded) {
            evidence.set(
              `${detection.photoId}:${detection.databaseId}`,
              {
                photo_id: detection.photoId,
                detection_id: detection.databaseId,
              },
            );
          }
        }

        for (const photoName of finding.evidence_photos) {
          for (const photo of photos) {
            const storedPhoto = photoLookup.get(photo.id);

            if (!storedPhoto || storedPhoto.fileName !== photoName) {
              continue;
            }

            const alreadyHasDetection = Array.from(evidence.values()).some(
              (item) => item.photo_id === storedPhoto.databaseId,
            );

            if (!alreadyHasDetection) {
              evidence.set(`${storedPhoto.databaseId}:photo`, {
                photo_id: storedPhoto.databaseId,
                detection_id: null,
              });
            }
          }
        }

        return {
          id: finding.id,
          category: finding.category,
          title: finding.title,
          description: finding.description,
          visible_evidence: finding.visible_evidence,
          risk_level: finding.risk_level,
          corrective_action: finding.corrective_action,
          uncertainty: finding.uncertainty,
          origin: finding.origin,
          modified_by_human: finding.modified_by_human,
          evidence: Array.from(evidence.values()),
        };
      });

    const payload = CloudInspectionPayloadSchema.parse({
      photos: cloudPhotos,
      findings: cloudFindings,
    });

    onProgress?.("SUBMITTING_DATA", photos.length, photos.length);
    const submitResponse = await fetch(`/api/inspections/${inspectionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!submitResponse.ok) {
      throw new Error(
        await readApiError(submitResponse, "云端事务提交失败。"),
      );
    }

    return { inspectionId, findingCount: cloudFindings.length };
  } catch (error) {
    if (inspectionId) {
      onProgress?.("CLEANING_UP", 0, photos.length);

      try {
        const cleanupResponse = await fetch(
          `/api/inspections/${inspectionId}`,
          { method: "DELETE" },
        );

        if (!cleanupResponse.ok) {
          const cleanupMessage = await readApiError(
            cleanupResponse,
            "清理失败",
          );
          console.error("Cloud draft cleanup failed", cleanupMessage);
        }
      } catch (cleanupError) {
        console.error("Cloud draft cleanup request failed", cleanupError);
      }
    }

    throw error;
  }
}
