"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { ProjectDetail } from "@/lib/project-queries";

type Feedback = { tone: "error" | "success"; message: string } | null;

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export function CreateProjectForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          code: formData.get("code"),
          description: formData.get("description"),
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "创建项目失败。"));
      }
      const body = (await response.json()) as { project: { id: string } };
      form.reset();
      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "创建项目失败。",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">MANAGER SETUP</p>
      <h2 className="mt-2 text-xl font-bold text-slate-950">创建施工项目</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        项目创建后，再添加已经注册并完成邮箱验证的巡检员。
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          项目名称
          <input
            name="name"
            required
            maxLength={150}
            placeholder="例如：滨江商务中心二期"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          项目编号
          <input
            name="code"
            required
            maxLength={50}
            pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
            placeholder="例如：BJC-2026"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>
      <label className="mt-4 block text-sm font-semibold text-slate-700">
        项目说明
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="施工范围、管理单位或其他必要说明"
          className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      {feedback && <FeedbackBanner feedback={feedback} />}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "正在创建……" : "创建项目"}
      </button>
    </form>
  );
}

export function ProjectAdministration({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPendingAction("project");
    setFeedback(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          code: formData.get("code"),
          description: formData.get("description"),
          status: formData.get("status"),
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "项目更新失败。"));
      setFeedback({ tone: "success", message: "项目资料已更新。" });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "项目更新失败。" });
    } finally {
      setPendingAction(null);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPendingAction("member");
    setFeedback(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      if (!response.ok) throw new Error(await readError(response, "添加成员失败。"));
      form.reset();
      setFeedback({ tone: "success", message: "巡检员已加入项目。" });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "添加成员失败。" });
    } finally {
      setPendingAction(null);
    }
  }

  async function removeMember(userId: string) {
    setPendingAction(userId);
    setFeedback(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readError(response, "移除成员失败。"));
      setConfirmRemove(null);
      setFeedback({ tone: "success", message: "巡检员已移出项目。" });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "移除成员失败。" });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
      <form onSubmit={updateProject} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">PROJECT SETTINGS</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">项目资料</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="项目名称" name="name" defaultValue={project.name} maxLength={150} />
          <Field label="项目编号" name="code" defaultValue={project.code} maxLength={50} />
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          项目状态
          <select
            name="status"
            defaultValue={project.status}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500"
          >
            <option value="ACTIVE">进行中</option>
            <option value="ARCHIVED">已归档</option>
          </select>
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          项目说明
          <textarea
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={project.description}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"
          />
        </label>
        <button
          type="submit"
          disabled={pendingAction !== null}
          className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pendingAction === "project" ? "正在保存……" : "保存项目资料"}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">TEAM MEMBERS</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">巡检员成员</h2>
        <form onSubmit={addMember} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            name="email"
            type="email"
            required
            list="available-inspectors"
            placeholder="巡检员登录邮箱"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
          <datalist id="available-inspectors">
            {project.availableInspectors.map((inspector) => (
              <option key={inspector.id} value={inspector.email}>
                {inspector.displayName}
              </option>
            ))}
          </datalist>
          <button
            type="submit"
            disabled={pendingAction !== null}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pendingAction === "member" ? "添加中……" : "添加成员"}
          </button>
        </form>

        <div className="mt-5 space-y-3">
          {project.members.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">项目还没有巡检员。</p>
          ) : (
            project.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{member.displayName}</p>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                </div>
                {confirmRemove === member.id ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void removeMember(member.id)}
                      disabled={pendingAction !== null}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      确认移除
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">
                      取消
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmRemove(member.id)} className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">
                    移除
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>
      {feedback && <div className="xl:col-span-2"><FeedbackBanner feedback={feedback} /></div>}
    </div>
  );
}

function Field({ label, name, defaultValue, maxLength }: { label: string; name: string; defaultValue: string; maxLength: number }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        name={name}
        required
        maxLength={maxLength}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"
      />
    </label>
  );
}

function FeedbackBanner({ feedback }: { feedback: Exclude<Feedback, null> }) {
  return (
    <p
      role="status"
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        feedback.tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {feedback.message}
    </p>
  );
}
