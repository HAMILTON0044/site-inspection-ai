import Link from "next/link";
import { ProductShell } from "@/components/product-shell";

export default function FindingNotFound() {
  return (
    <ProductShell activeItem="findings" pageLabel="问题详情" title="问题不存在或无权查看">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-600">404</div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">找不到这个问题</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">问题可能不存在、仍属于未提交草稿，或者当前账号不属于对应项目。</p>
          <Link href="/findings" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">返回问题看板</Link>
        </section>
      </main>
    </ProductShell>
  );
}
