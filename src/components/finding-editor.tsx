"use client";

import { FormEvent, useState } from "react";
import type { InspectionAnalysis } from "@/lib/schemas";

type Finding = InspectionAnalysis["findings"][number];

export type FindingEditorValue = Pick<
  Finding,
  | "category"
  | "title"
  | "description"
  | "visible_evidence"
  | "evidence_photos"
  | "evidence_detection_ids"
  | "risk_level"
  | "corrective_action"
  | "uncertainty"
>;

type FindingEditorProps = {
  initialValue: FindingEditorValue;
  photoNames: string[];
  submitLabel: string;
  onSave: (value: FindingEditorValue) => void;
  onCancel: () => void;
};

const categoryOptions: Array<{
  value: Finding["category"];
  label: string;
}> = [
  { value: "BLOCKED_ACCESS", label: "通道或出口堵塞" },
  { value: "UNSAFE_CABLE", label: "电缆安全问题" },
  { value: "MISSING_PPE", label: "缺少个人防护装备" },
  { value: "IMPROPER_STORAGE", label: "材料堆放不规范" },
];

const riskOptions: Array<{
  value: Finding["risk_level"];
  label: string;
}> = [
  { value: "LOW", label: "低风险" },
  { value: "MEDIUM", label: "中风险" },
  { value: "HIGH", label: "高风险" },
  { value: "CRITICAL", label: "严重风险" },
  { value: "UNCONFIRMED", label: "风险待确认" },
];

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function FindingEditor({
  initialValue,
  photoNames,
  submitLabel,
  onSave,
  onCancel,
}: FindingEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [uncertaintyText, setUncertaintyText] = useState(
    initialValue.uncertainty.join("\n"),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      ...value,
      title: value.title.trim(),
      description: value.description.trim(),
      visible_evidence: value.visible_evidence.trim(),
      corrective_action: value.corrective_action.trim(),
      uncertainty: uncertaintyText
        .split("\n")
        .map((item) => item.trim())
        .filter((item, index, items) =>
          item.length > 0 && items.indexOf(item) === index
        ),
    });
  }

  function toggleEvidencePhoto(photoName: string) {
    setValue((currentValue) => ({
      ...currentValue,
      evidence_photos: currentValue.evidence_photos.includes(photoName)
        ? currentValue.evidence_photos.filter(
            (currentPhotoName) => currentPhotoName !== photoName,
          )
        : [...currentValue.evidence_photos, photoName],
    }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-5"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          问题类别
          <select
            value={value.category}
            onChange={(event) =>
              setValue((currentValue) => ({
                ...currentValue,
                category: event.target.value as Finding["category"],
              }))
            }
            className={inputClassName}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700">
          风险等级
          <select
            value={value.risk_level}
            onChange={(event) =>
              setValue((currentValue) => ({
                ...currentValue,
                risk_level: event.target.value as Finding["risk_level"],
              }))
            }
            className={inputClassName}
          >
            {riskOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-5 block text-sm font-semibold text-slate-700">
        问题标题
        <input
          required
          value={value.title}
          onChange={(event) =>
            setValue((currentValue) => ({
              ...currentValue,
              title: event.target.value,
            }))
          }
          className={inputClassName}
        />
      </label>

      <label className="mt-5 block text-sm font-semibold text-slate-700">
        问题描述
        <textarea
          required
          rows={3}
          value={value.description}
          onChange={(event) =>
            setValue((currentValue) => ({
              ...currentValue,
              description: event.target.value,
            }))
          }
          className={inputClassName}
        />
      </label>

      <label className="mt-5 block text-sm font-semibold text-slate-700">
        可见证据
        <textarea
          required
          rows={3}
          value={value.visible_evidence}
          onChange={(event) =>
            setValue((currentValue) => ({
              ...currentValue,
              visible_evidence: event.target.value,
            }))
          }
          className={inputClassName}
        />
      </label>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-slate-700">
          证据照片（可多选）
        </legend>
        {photoNames.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {photoNames.map((photoName) => (
              <label
                key={photoName}
                className={`cursor-pointer rounded-full border px-3 py-2 text-sm transition ${
                  value.evidence_photos.includes(photoName)
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={value.evidence_photos.includes(photoName)}
                  onChange={() => toggleEvidencePhoto(photoName)}
                  className="sr-only"
                />
                {photoName}
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">当前没有已选照片。</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          不选择照片时，证据来源将显示为“巡检备注”。
        </p>
      </fieldset>

      <label className="mt-5 block text-sm font-semibold text-slate-700">
        建议整改措施
        <textarea
          required
          rows={3}
          value={value.corrective_action}
          onChange={(event) =>
            setValue((currentValue) => ({
              ...currentValue,
              corrective_action: event.target.value,
            }))
          }
          className={inputClassName}
        />
      </label>

      <label className="mt-5 block text-sm font-semibold text-slate-700">
        待确认事项（每行一项，可留空）
        <textarea
          rows={3}
          value={uncertaintyText}
          onChange={(event) => setUncertaintyText(event.target.value)}
          className={inputClassName}
        />
      </label>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          取消
        </button>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
