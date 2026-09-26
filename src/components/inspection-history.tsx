"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
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

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
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
  const { locale, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(
    null,
  );

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{t("history.title")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("history.description")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {isOpen
              ? t("history.collapse")
              : `${t("history.view")} (${records.length})`}
          </button>
          <button
            type="button"
            disabled={!canSave || busyRecordId !== null}
            onClick={onSave}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyRecordId === "SAVE"
              ? t("history.saving")
              : currentRecordId === null
                ? t("history.save")
                : t("history.update")}
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
            <p className="text-sm text-slate-500">{t("history.reading")}</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("history.empty")}
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
                          {t("history.updatedAt")} {formatDate(record.updatedAt, locale === "zh" ? "zh-CN" : "en-SG")} ·{" "}
                          {record.photos.length} {t("common.photoCount")} ·{" "}
                          {record.analysis.findings.length} {t("common.findingCount")}
                        </p>
                        {isCurrent && (
                          <span className="mt-2 inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {t("history.current")}
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
                              {t("common.cancel")}
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
                              {t("common.confirmDelete")}
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
                              {isBusy ? t("common.loading") : t("common.load")}
                            </button>
                            <button
                              type="button"
                              disabled={busyRecordId !== null}
                              onClick={() => setPendingDeleteId(record.id)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {t("common.delete")}
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
