"use client";

import type { InspectionAnalysis } from "@/lib/schemas";
import type { VisionDetection } from "@/lib/vision";

const DATABASE_NAME = "site-inspection-ai";
const DATABASE_VERSION = 1;
const STORE_NAME = "inspections";

export type StoredReviewDecision =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type StoredPhoto = {
  id: string;
  fileName: string;
  fileType: string;
  fileLastModified: number;
  blob: Blob;
  detectionStatus: "IDLE" | "RUNNING" | "DONE" | "ERROR";
  detections: VisionDetection[];
  excludedDetectionIndexes: number[];
  error: string;
};

export type StoredInspectionRecord = {
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  analysis: InspectionAnalysis;
  reviewDecisions: Record<string, StoredReviewDecision>;
  photos: StoredPhoto[];
  activePhotoId: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("无法打开本地巡检数据库。"));
    request.onblocked = () =>
      reject(new Error("本地巡检数据库被其他页面占用，请关闭其他标签页后重试。"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("本地数据库操作失败。"));
  });
}

export async function listInspectionRecords() {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = await requestToPromise<StoredInspectionRecord[]>(
      transaction.objectStore(STORE_NAME).getAll(),
    );

    return records.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  } finally {
    database.close();
  }
}

export async function saveInspectionRecord(
  record: StoredInspectionRecord,
) {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestToPromise(transaction.objectStore(STORE_NAME).put(record));
  } finally {
    database.close();
  }
}

export async function deleteInspectionRecord(recordId: string) {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestToPromise(
      transaction.objectStore(STORE_NAME).delete(recordId),
    );
  } finally {
    database.close();
  }
}
