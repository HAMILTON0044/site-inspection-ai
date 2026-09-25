"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FindingRisk, FindingStatus } from "@/lib/finding-queries";

type WorkflowFinding = {
  id: string;
  projectId: string;
  inspectionId: string;
  status: FindingStatus;
  riskLevel: FindingRisk;
  assigneeId: string | null;
  dueAt: string | null;
  projectMembers: Array<{ id: string; displayName: string; email: string }>;
};

type WorkflowUser = { id: string; role: "INSPECTOR" | "MANAGER" };
type Feedback = { tone: "error" | "success"; message: string } | null;

const riskOptions: Array<{ value: FindingRisk; label: string }> = [
  { value: "UNCONFIRMED", label: "风险待确认" },
  { value: "LOW", label: "低风险" },
  { value: "MEDIUM", label: "中风险" },
  { value: "HIGH", label: "高风险" },
  { value: "CRITICAL", label: "严重风险" },
];

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

function extensionFor(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  throw new Error("整改照片仅支持 JPEG、PNG 和 WebP。 ");
}

function localDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function FindingWorkflowPanel({
  finding,
  currentUser,
}: {
  finding: WorkflowFinding;
  currentUser: WorkflowUser;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [decisionComment, setDecisionComment] = useState("");
  const isManager = currentUser.role === "MANAGER";
  const isAssignee = finding.assigneeId === currentUser.id;
  const canStart =
    (isManager || isAssignee) &&
    (finding.status === "ASSIGNED" || finding.status === "REOPENED");
  const canRequestVerification =
    (isManager || isAssignee) && finding.status === "IN_PROGRESS";
  const canFollowUp = finding.status !== "CLOSED";
  const members = useMemo(
    () => [...finding.projectMembers].sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-CN")),
    [finding.projectMembers],
  );

  async function manageFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const dueAtValue = formData.get("dueAt")?.toString() ?? "";
    setPending("manage");
    setFeedback(null);
    try {
      const response = await fetch(`/api/findings/${finding.id}/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeId: formData.get("assigneeId") || null,
          dueAt: dueAtValue ? new Date(dueAtValue).toISOString() : null,
          riskLevel: formData.get("riskLevel"),
          comment: formData.get("comment"),
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "问题设置更新失败。"));
      setFeedback({ tone: "success", message: "负责人、期限和风险设置已更新。" });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "问题设置更新失败。" });
    } finally {
      setPending(null);
    }
  }

  async function transition(status: FindingStatus) {
    setPending(status);
    setFeedback(null);
    try {
      const response = await fetch(`/api/findings/${finding.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment: decisionComment }),
      });
      if (!response.ok) throw new Error(await readError(response, "状态更新失败。"));
      setDecisionComment("");
      setFeedback({ tone: "success", message: "问题状态已更新。" });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "状态更新失败。" });
    } finally {
      setPending(null);
    }
  }

  async function addFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const comment = formData.get("comment")?.toString().trim() ?? "";
    const submitForVerification = formData.get("submitForVerification") === "on";

    if (files.length > 5) {
      setFeedback({ tone: "error", message: "一次最多上传 5 张整改照片。" });
      return;
    }
    for (const file of files) {
      extensionFor(file.type);
      if (file.size > 10 * 1024 * 1024) {
        setFeedback({ tone: "error", message: `“${file.name}”超过 10 MB。` });
        return;
      }
      if (file.name.length > 255) {
        setFeedback({ tone: "error", message: `“${file.name}”文件名过长。` });
        return;
      }
    }

    setPending("follow-up");
    setFeedback(null);
    const followUpId = crypto.randomUUID();
    const uploadedKeys: string[] = [];
    const supabase = createClient();

    try {
      const photos = [];
      for (const file of files) {
        const id = crypto.randomUUID();
        const storageKey = `${finding.projectId}/${finding.inspectionId}/follow-ups/${finding.id}/${followUpId}/${id}.${extensionFor(file.type)}`;
        const { error } = await supabase.storage.from("inspection-photos").upload(storageKey, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw new Error(`上传“${file.name}”失败：${error.message}`);
        uploadedKeys.push(storageKey);
        photos.push({
          id,
          storage_key: storageKey,
          original_file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
      }

      const response = await fetch(`/api/findings/${finding.id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpId, comment, photos, submitForVerification }),
      });
      if (!response.ok) throw new Error(await readError(response, "整改跟进提交失败。"));

      form.reset();
      setFeedback({
        tone: "success",
        message: submitForVerification ? "整改证据已提交，正在等待 Manager 复核。" : "整改跟进已保存。",
      });
      router.refresh();
    } catch (error) {
      if (uploadedKeys.length > 0) {
        const { error: cleanupError } = await supabase.storage.from("inspection-photos").remove(uploadedKeys);
        if (cleanupError) console.error("Failed to clean up follow-up uploads", cleanupError);
      }
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "整改跟进提交失败。" });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {feedback.message}
        </p>
      )}

      {isManager && finding.status !== "CLOSED" && (
        <form onSubmit={manageFinding} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">MANAGER CONTROL</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">指派与风险设置</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              负责人
              <select name="assigneeId" defaultValue={finding.assigneeId ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                <option value="">尚未分配</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.email}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              整改期限
              <input name="dueAt" type="datetime-local" defaultValue={localDateTimeValue(finding.dueAt)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              风险等级
              <select name="riskLevel" defaultValue={finding.riskLevel} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                {riskOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            调整说明（可选）
            <input name="comment" maxLength={5000} placeholder="说明本次指派或风险调整原因" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <button type="submit" disabled={pending !== null} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {pending === "manage" ? "保存中……" : "保存管理设置"}
          </button>
        </form>
      )}

      {(canStart || (isManager && finding.status === "AWAITING_VERIFICATION")) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">WORKFLOW ACTION</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">状态操作</h2>
          {isManager && finding.status === "AWAITING_VERIFICATION" && (
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              复核结论（必填）
              <textarea value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} rows={3} maxLength={5000} placeholder="说明关闭依据，或重新打开的原因" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {canStart && (
              <button type="button" onClick={() => void transition("IN_PROGRESS")} disabled={pending !== null} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {pending === "IN_PROGRESS" ? "更新中……" : "开始整改"}
              </button>
            )}
            {isManager && finding.status === "AWAITING_VERIFICATION" && (
              <>
                <button type="button" onClick={() => void transition("CLOSED")} disabled={pending !== null || !decisionComment.trim()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">复核通过并关闭</button>
                <button type="button" onClick={() => void transition("REOPENED")} disabled={pending !== null || !decisionComment.trim()} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">复核不通过，重新打开</button>
              </>
            )}
          </div>
        </section>
      )}

      {canFollowUp && (
        <form onSubmit={addFollowUp} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">CORRECTIVE FOLLOW-UP</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">添加整改跟进</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">同项目成员可以补充现场进展；每次记录永久保留，不覆盖原巡检报告。</p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            跟进说明
            <textarea name="comment" required rows={4} maxLength={5000} placeholder="描述已采取的措施、现场复查情况或仍需协调的事项" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            整改照片（最多 5 张，每张不超过 10 MB）
            <input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal" />
          </label>
          {canRequestVerification && (
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
              <input name="submitForVerification" type="checkbox" className="mt-0.5 h-4 w-4" />
              <span><strong>同时提交 Manager 复核</strong><br /><span className="text-blue-700">勾选后状态会变为“等待复核”。</span></span>
            </label>
          )}
          <button type="submit" disabled={pending !== null} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {pending === "follow-up" ? "上传并保存中……" : "保存整改跟进"}
          </button>
        </form>
      )}
    </div>
  );
}
