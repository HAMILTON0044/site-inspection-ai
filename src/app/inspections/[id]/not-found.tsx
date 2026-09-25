import Link from "next/link";
import { ProductShell } from "@/components/product-shell";

export default function InspectionNotFound() {
  return (
    <ProductShell
      activeItem="records"
      pageLabel="巡检详情"
      title="记录不存在或无权查看"
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-600">
            404
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            找不到这条巡检记录
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
            记录可能不存在、尚未正式提交，或者当前账号不属于对应项目。系统不会泄露无权访问的巡检信息。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/inspections"
              className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              返回巡检记录
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              新建巡检
            </Link>
          </div>
        </section>
      </main>
    </ProductShell>
  );
}
