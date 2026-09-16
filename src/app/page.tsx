"use client";

import { FormEvent, useState } from "react";

export default function Home() {
  const [note, setNote] = useState(
    "三层东侧通道有建筑材料堵塞，旁边的电缆没有固定。",
  );
  const [result, setResult] = useState<unknown>(null);
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

      setResult(data);
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
            <div className="flex items-center justify-between">
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

            <pre className="mt-4 max-h-[600px] overflow-auto rounded-xl bg-slate-950 p-5 text-sm leading-6 text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}