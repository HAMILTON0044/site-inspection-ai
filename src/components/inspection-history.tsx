"use client";

import { useState } from "react";
import type { StoredInspectionRecord } from "@/lib/inspection-store";

type InspectionHistoryProps = {
  records: StoredInspectionRecord[];
  currentRecordId: string | null;
  canSave: boolean;
  loading: boolean;
  busyRecordId: string | null;
  message: string;
  onSave: () => void;
  onLoad: (record: StoredInspectionRecord) => void;
  onDelete: (recordId: string) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function InspectionHistory({
  records,
  currentRecordId,
  canSave,
  loading,
  busyRecordId,
  message,
  onSave,
  onLoad,
  onDelete,
}: InspectionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(
    null,
  );

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">本地巡检历史</h2>
          <p className="mt-1 text-xs text-slate-500">
            记录和照片仅保存在当前浏览器，不会上传到云端。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {isOpen
              ? "收起历史"
              : "查看历史（" + records.length + "）"}
          </button>
          <button
            type="button"
            disabled={!canSave || busyRecordId !== null}
            onClick={onSave}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyRecordId === "SAVE"
              ? "正在保存……"
              : currentRecordId === null
                ? "保存巡检记录"
                : "更新当前记录"}
          </button>
        </div>
      </div>

      {message.length > 0 && (
        <p
          aria-live="polite"
          className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
        >
          {message}
        </p>
      )}

      {isOpen && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          {loading ? (
            <p className="text-sm text-slate-500">正在读取本地记录……</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">
              暂无记录。完成一次分析后点击“保存巡检记录”。
            </p>
          ) : (
            <ul className="space-y-3">
              {records.map((record) => {
                const isCurrent = record.id === currentRecordId;
                const isBusy = busyRecordId === record.id;

                return (
                  <li
                    key={record.id}
                    className={
                      "rounded-lg border bg-white p-4 " +
                      (isCurrent
                        ? "border-blue-400 ring-2 ring-blue-100"
                        : "border-slate-200")
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {record.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          更新于 {formatDate(record.updatedAt)} ·{" "}
                          {record.photos.length} 张照片 ·{" "}
                          {record.analysis.findings.length} 条问题
                        </p>
                        {isCurrent && (
                          <span className="mt-2 inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                            当前记录
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {pendingDeleteId === record.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(null)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                onDelete(record.id);
                                setPendingDeleteId(null);
                              }}
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              确认删除
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busyRecordId !== null}
                              onClick={() => onLoad(record)}
                              className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              {isBusy ? "载入中……" : "载入"}
                            </button>
                            <button
                              type="button"
                              disabled={busyRecordId !== null}
                              onClick={() => setPendingDeleteId(record.id)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
