import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductShell } from "@/components/product-shell";
import { ProjectAdministration } from "@/components/project-admin-forms";
import { getProjectDetail } from "@/lib/project-queries";
import { getLocale } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "项目详情 | Site Inspection AI" };

export default async function ProjectDetailPage({ params }: PageProps<"/projects/[id]">) {
  const locale = await getLocale();
  const l = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const { id } = await params;
  const result = await getProjectDetail(id);
  if (!result.ok && result.status === 401) redirect("/login");
  if (!result.ok && result.status === 404) notFound();

  return (
    <ProductShell activeItem="projects" pageLabel={l("项目详情", "Project Details")} title={result.ok ? `${result.data.code} · ${result.data.name}` : l("项目详情", "Project Details")}>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link href="/projects" className="text-sm font-semibold text-slate-600 hover:text-blue-700">← {l("返回项目列表", "Back to projects")}</Link>
        {!result.ok ? (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.error}</section>
        ) : (
          <>
            <section className="mt-5 rounded-3xl bg-[#0b1728] px-6 py-8 text-white sm:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-950">{result.data.code}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">{result.data.status === "ACTIVE" ? l("进行中", "Active") : l("已归档", "Archived")}</span>
                  </div>
                  <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{result.data.name}</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{result.data.description || l("暂无项目说明。", "No project description.")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 lg:min-w-80">
                  <HeroMetric label={l("成员", "Members")} value={result.data.memberCount} />
                  <HeroMetric label={l("巡检", "Inspections")} value={result.data.inspectionCount} />
                  <HeroMetric label={l("开放问题", "Open findings")} value={result.data.openFindingCount} />
                </div>
              </div>
            </section>

            <section className="mt-6">
              {result.currentUser.role === "MANAGER" ? (
                <ProjectAdministration project={result.data} />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-950">{l("项目成员", "Project members")}</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {result.data.members.map((member) => (
                      <div key={member.id} className="rounded-xl bg-slate-50 px-4 py-3">
                        <p className="font-bold text-slate-900">{member.displayName}</p>
                        <p className="mt-1 text-xs text-slate-500">{member.email}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-sm text-slate-500">{l("成员调整仅可由 Manager 执行。", "Only a Manager can change project membership.")}</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </ProductShell>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>;
}
