import Link from "next/link";
import { ProductShell } from "@/components/product-shell";

export default function ProjectNotFound() {
  return (
    <ProductShell activeItem="projects" pageLabel="项目详情" title="项目不存在或无权查看">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-600">404</div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">找不到这个项目</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">项目可能不存在，或者当前账号不是该项目成员。</p>
          <Link href="/projects" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">返回项目列表</Link>
        </section>
      </main>
    </ProductShell>
  );
}
