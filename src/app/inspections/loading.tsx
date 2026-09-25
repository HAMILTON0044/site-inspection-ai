export default function InspectionsLoading() {
  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-10 lg:pl-72 lg:pr-8">
      <div className="mx-auto w-full max-w-[1184px] animate-pulse">
        <div className="h-44 rounded-3xl bg-slate-900" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="h-24 rounded-2xl bg-white" />
          <div className="h-24 rounded-2xl bg-white" />
          <div className="h-24 rounded-2xl bg-white" />
        </div>
        <div className="mt-6 h-56 rounded-2xl bg-white" />
      </div>
    </main>
  );
}
