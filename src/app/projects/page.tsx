import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateProjectForm } from "@/components/project-admin-forms";
import { ProductShell } from "@/components/product-shell";
import { getProjectOverview } from "@/lib/project-queries";

export const metadata: Metadata = { title: "团队与项目 | Site Inspection AI" };

export default async function ProjectsPage() {
  const result = await getProjectOverview();
  if (!result.ok && result.status === 401) redirect("/login");

  return (
    <ProductShell activeItem="projects" pageLabel="团队与项目" title="项目权限与巡检团队">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-3xl bg-[#0b1728] px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">PROJECT CONTROL</p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">团队与项目</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            项目决定巡检记录和问题的访问边界。巡检员只能读取自己参与项目中的正式记录。
          </p>
        </section>

        {!result.ok ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.error}</section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Metric label="可访问项目" value={result.data.length} />
              <Metric label="进行中项目" value={result.data.filter((project) => project.status === "ACTIVE").length} />
              <Metric label="开放问题" value={result.data.reduce((sum, project) => sum + project.openFindingCount, 0)} />
            </section>

            {result.currentUser.role === "MANAGER" && <div className="mt-6"><CreateProjectForm /></div>}

            <section className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-blue-600">PROJECT REGISTER</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">项目列表</h2>
                </div>
                <p className="text-sm text-slate-500">当前角色：{result.currentUser.role === "MANAGER" ? "Manager" : "巡检员"}</p>
              </div>
              {result.data.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-600">
                  {result.currentUser.role === "MANAGER" ? "请先创建第一个施工项目。" : "你还没有加入任何项目，请联系 Manager。"}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {result.data.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{project.code}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${project.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {project.status === "ACTIVE" ? "进行中" : "已归档"}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-slate-950 group-hover:text-blue-700">{project.name}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{project.description || "暂无项目说明。"}</p>
                        </div>
                        <span className="text-xl text-slate-300 group-hover:text-blue-500">→</span>
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                        <SmallMetric label="成员" value={project.memberCount} />
                        <SmallMetric label="巡检" value={project.inspectionCount} />
                        <SmallMetric label="开放问题" value={project.openFindingCount} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </ProductShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>;
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 px-2 py-3"><p className="text-lg font-bold text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div>;
}
