// Job detail card loading skeleton (task 7.5), ported from JobCardSkeleton.vue.
export function JobCardSkeleton() {
  return (
    <div className="flex grow animate-pulse flex-col p-8">
      <div className="mb-6">
        <div className="mb-5 h-8 w-3/4 rounded bg-[#001f2a]/[0.08]" />
        <div className="flex flex-wrap gap-3">
          <div className="h-5 w-24 rounded bg-[#001f2a]/[0.08]" />
          <div className="h-5 w-32 rounded bg-[#001f2a]/[0.08]" />
          <div className="ml-auto flex gap-3">
            <div className="h-5 w-28 rounded bg-[#001f2a]/[0.08]" />
          </div>
        </div>
      </div>
      <div className="space-y-3 py-1">
        {['w-full', 'w-5/6', 'w-full', 'w-4/6'].map((w, i) => (
          <div key={i} className={`h-4 rounded bg-[#001f2a]/[0.08] ${w}`} />
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {['w-16', 'w-20', 'w-24', 'w-14'].map((w, i) => (
          <div
            key={i}
            className={`h-6 rounded-full bg-[#001f2a]/[0.08] ${w}`}
          />
        ))}
      </div>
    </div>
  );
}
