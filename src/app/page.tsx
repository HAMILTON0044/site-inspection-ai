"use client";

import { FormEvent, useState } from "react";
import type { InspectionAnalysis } from "@/lib/schemas";

type AnalyzeResponse = {
  analysis: InspectionAnalysis;
  reviewed: boolean;
};

type Finding = InspectionAnalysis["findings"][number];

const categoryLabels: Record<Finding["category"], string> = {
  BLOCKED_ACCESS: "通道或出口堵塞",
  UNSAFE_CABLE: "电缆安全问题",
  MISSING_PPE: "缺少个人防护装备",
  IMPROPER_STORAGE: "材料堆放不规范",
};

const riskLabels: Record<Finding["risk_level"], string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "严重风险",
  UNCONFIRMED: "风险待确认",
};

const riskStyles: Record<Finding["risk_level"], string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
  UNCONFIRMED: "bg-slate-200 text-slate-700",
};

export default function Home() {
  const [note, setNote] = useState(
    "三层东侧通道有建筑材料堵塞，旁边的电缆没有固定。",
  );
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
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
            "巡检分析失败",
        );
      }

      setResult(data as AnalyzeResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "发生未知错误",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-lg">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Site Inspection AI
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            AI 现场巡检分析
          </h1>

          <p className="mt-3 text-slate-600">
            输入现场巡检备注，生成等待人工确认的问题草稿。
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8">
          <label
            htmlFor="inspection-note"
            className="block font-semibold text-slate-800"
          >
            巡检备注
          </label>

          <textarea
            id="inspection-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={7}
            placeholder="例如：三层东侧通道有建筑材料堵塞……"
            className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="submit"
            disabled={loading || note.trim().length < 3}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "AI 正在分析……" : "开始分析"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">分析失败</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {result !== null && (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">
                AI 分析草稿
              </h2>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                等待人工审核
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              以下内容由 AI 生成，不能直接作为最终安全结论。
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">
                巡检位置
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {result.analysis.location}
              </p>

              <p className="mt-4 text-sm font-medium text-slate-500">
                分析摘要
              </p>
              <p className="mt-1 text-slate-800">
                {result.analysis.summary}
              </p>
            </div>

            {result.analysis.findings.length === 0 ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                当前备注中没有识别到系统支持的问题。
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {result.analysis.findings.map((finding, index) => (
                  <article
                    key={`${finding.category}-${index}`}
                    className="rounded-xl border border-slate-200 p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-blue-600">
                          问题 {index + 1} ·{" "}
                          {categoryLabels[finding.category]}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {finding.title}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          riskStyles[finding.risk_level]
                        }`}
                      >
                        {riskLabels[finding.risk_level]}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-4">
                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          问题描述
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.description}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          可见证据
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.visible_evidence}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-500">
                          建议整改措施
                        </dt>
                        <dd className="mt-1 text-slate-800">
                          {finding.corrective_action}
                        </dd>
                      </div>
                    </dl>

                    {finding.uncertainty.length > 0 && (
                      <div className="mt-5 rounded-lg bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">
                          待人工确认
                        </p>

                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                          {finding.uncertainty.map((item, itemIndex) => (
                            <li key={`${item}-${itemIndex}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
                      AI 草稿 · 必须由授权巡检人员审核
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}