"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { createClient } from "@/lib/supabase/client";
import { riskLabel } from "@/lib/i18n";
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

const risks: FindingRisk[] = ["UNCONFIRMED", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

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
  const { locale } = useLanguage();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
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
  const canFollowUp =
    (isManager || isAssignee) && finding.status !== "CLOSED";
  const canReview =
    isManager &&
    (finding.status === "AWAITING_VERIFICATION" ||
      finding.status === "CLOSED");
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
      if (!response.ok) throw new Error(await readError(response, l("问题设置更新失败。", "Unable to update finding settings.")));
      setFeedback({ tone: "success", message: l("负责人、期限和风险设置已更新。", "Assignee, due date and risk settings updated.") });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : l("问题设置更新失败。", "Unable to update finding settings.") });
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
      if (!response.ok) throw new Error(await readError(response, l("状态更新失败。", "Unable to update the status.")));
      setDecisionComment("");
      setFeedback({ tone: "success", message: l("问题状态已更新。", "Finding status updated.") });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : l("状态更新失败。", "Unable to update the status.") });
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
      setFeedback({ tone: "error", message: l("一次最多上传 5 张整改照片。", "Upload no more than 5 corrective-action photos.") });
      return;
    }
    try {
      for (const file of files) {
        extensionFor(file.type);
        if (file.size > 10 * 1024 * 1024) {
          setFeedback({ tone: "error", message: l(`“${file.name}”超过 10 MB。`, `“${file.name}” is larger than 10 MB.`) });
          return;
        }
        if (file.name.length > 255) {
          setFeedback({ tone: "error", message: l(`“${file.name}”文件名过长。`, `The filename “${file.name}” is too long.`) });
          return;
        }
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : l("整改照片格式不受支持。", "The corrective-action photo format is not supported."),
      });
      return;
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
        if (error) throw new Error(l(`上传“${file.name}”失败：${error.message}`, `Failed to upload “${file.name}”: ${error.message}`));
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
      if (!response.ok) throw new Error(await readError(response, l("整改跟进提交失败。", "Unable to submit the corrective-action update.")));

      form.reset();
      setFeedback({
        tone: "success",
        message: submitForVerification ? l("整改证据已提交，正在等待 Manager 复核。", "Corrective evidence submitted and awaiting Manager review.") : l("整改跟进已保存。", "Corrective-action update saved."),
      });
      router.refresh();
    } catch (error) {
      if (uploadedKeys.length > 0) {
        const { error: cleanupError } = await supabase.storage.from("inspection-photos").remove(uploadedKeys);
        if (cleanupError) console.error("Failed to clean up follow-up uploads", cleanupError);
      }
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : l("整改跟进提交失败。", "Unable to submit the corrective-action update.") });
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
          <h2 className="mt-2 text-lg font-bold text-slate-950">{l("指派与风险设置", "Assignment & risk settings")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              {l("负责人", "Assignee")}
              <select name="assigneeId" defaultValue={finding.assigneeId ?? ""} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                <option value="">{l("尚未分配", "Unassigned")}</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.email}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {l("整改期限", "Due date")}
              <input name="dueAt" type="datetime-local" defaultValue={localDateTimeValue(finding.dueAt)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {l("风险等级", "Risk level")}
              <select name="riskLevel" defaultValue={finding.riskLevel} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal">
                {risks.map((risk) => <option key={risk} value={risk}>{riskLabel(locale, risk)}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            {l("调整说明（可选）", "Change note (optional)")}
            <input name="comment" maxLength={5000} placeholder={l("说明本次指派或风险调整原因", "Explain the assignment or risk adjustment")} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <button type="submit" disabled={pending !== null} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {pending === "manage" ? l("保存中……", "Saving…") : l("保存管理设置", "Save management settings")}
          </button>
        </form>
      )}

      {(canStart || canReview) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">WORKFLOW ACTION</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">{l("状态操作", "Status actions")}</h2>
          {canReview && (
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              {l("复核结论（必填）", "Review decision (required)")}
              <textarea value={decisionComment} onChange={(event) => setDecisionComment(event.target.value)} rows={3} maxLength={5000} placeholder={l("说明关闭依据，或重新打开的原因", "Explain why the finding is being closed or reopened")} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {canStart && (
              <button type="button" onClick={() => void transition("IN_PROGRESS")} disabled={pending !== null} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {pending === "IN_PROGRESS" ? l("更新中……", "Updating…") : l("开始整改", "Start corrective action")}
              </button>
            )}
            {isManager && finding.status === "AWAITING_VERIFICATION" && (
              <>
                <button type="button" onClick={() => void transition("CLOSED")} disabled={pending !== null || !decisionComment.trim()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{l("复核通过并关闭", "Approve & close")}</button>
                <button type="button" onClick={() => void transition("REOPENED")} disabled={pending !== null || !decisionComment.trim()} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{l("复核不通过，重新打开", "Reject review & reopen")}</button>
              </>
            )}
            {isManager && finding.status === "CLOSED" && (
              <button type="button" onClick={() => void transition("REOPENED")} disabled={pending !== null || !decisionComment.trim()} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {pending === "REOPENED" ? l("重新打开中……", "Reopening…") : l("重新打开问题", "Reopen finding")}
              </button>
            )}
          </div>
        </section>
      )}

      {canFollowUp && (
        <form onSubmit={addFollowUp} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">CORRECTIVE FOLLOW-UP</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">{l("添加整改跟进", "Add corrective-action update")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{l("当前负责人或 Manager 可以补充现场进展；每次记录永久保留，不覆盖原巡检报告。", "The assignee or a Manager can add site progress. Every entry is retained and never overwrites the original report.")}</p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            {l("跟进说明", "Update note")}
            <textarea name="comment" required rows={4} maxLength={5000} placeholder={l("描述已采取的措施、现场复查情况或仍需协调的事项", "Describe actions taken, reinspection results or outstanding coordination")} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            {l("整改照片（最多 5 张，每张不超过 10 MB）", "Corrective-action photos (up to 5, maximum 10 MB each)")}
            <input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal" />
          </label>
          {canRequestVerification && (
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
              <input name="submitForVerification" type="checkbox" className="mt-0.5 h-4 w-4" />
              <span><strong>{l("同时提交 Manager 复核", "Submit for Manager review")}</strong><br /><span className="text-blue-700">{l("勾选后状态会变为“等待复核”。", "The status will change to “Awaiting verification”.")}</span></span>
            </label>
          )}
          <button type="submit" disabled={pending !== null} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {pending === "follow-up" ? l("上传并保存中……", "Uploading & saving…") : l("保存整改跟进", "Save corrective-action update")}
          </button>
        </form>
      )}
    </div>
  );
}
