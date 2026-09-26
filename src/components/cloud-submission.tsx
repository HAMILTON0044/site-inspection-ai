"use client";

import type { CloudProject } from "@/lib/cloud-inspection-schema";
import { useLanguage } from "@/components/language-provider";

type CloudSubmissionProps = {
  projects: CloudProject[];
  selectedProjectId: string;
  projectsLoading: boolean;
  busy: boolean;
  canSubmit: boolean;
  pendingFindings: number;
  approvedFindings: number;
  rejectedFindings: number;
  message: string;
  submittedInspectionId: string;
  onProjectChange: (projectId: string) => void;
  onSubmit: () => void;
};

export function CloudSubmission({
  projects,
  selectedProjectId,
  projectsLoading,
  busy,
  canSubmit,
  pendingFindings,
  approvedFindings,
  rejectedFindings,
  message,
  submittedInspectionId,
  onProjectChange,
  onSubmit,
}: CloudSubmissionProps) {
  const { t } = useLanguage();

  return (
    <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-semibold text-slate-900">{t("submission.title")}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {t("submission.description")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
            {t("submission.approved")} {approvedFindings}
          </span>
          <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
            {t("submission.rejected")} {rejectedFindings}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
            {t("submission.pending")} {pendingFindings}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm font-medium text-slate-700">
          {t("submission.project")}
          <select
            value={selectedProjectId}
            onChange={(event) => onProjectChange(event.target.value)}
            disabled={
              projectsLoading ||
              busy ||
              projects.length === 0 ||
              submittedInspectionId.length > 0
            }
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            {projects.length === 0 ? (
              <option value="">
                {projectsLoading ? t("submission.loadingProjects") : t("submission.noProjects")}
              </option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}（{project.code}）
                </option>
              ))
            )}
          </select>
        </label>

        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={onSubmit}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? t("submission.submitting")
            : submittedInspectionId
              ? t("submission.submitted")
              : t("submission.submit")}
        </button>
      </div>

      {!projectsLoading && projects.length === 0 && (
        <p className="mt-3 text-sm text-amber-800">
          {t("submission.noProjectMembership")}
        </p>
      )}

      {pendingFindings > 0 && (
        <p className="mt-3 text-sm text-amber-800">
          {t("submission.reviewFirst")}
        </p>
      )}

      {message && (
        <p
          aria-live="polite"
          className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
        >
          {message}
        </p>
      )}

      {submittedInspectionId && (
        <p className="mt-2 break-all text-xs text-emerald-700">
          {t("submission.cloudId")}：{submittedInspectionId}
        </p>
      )}
    </section>
  );
}
