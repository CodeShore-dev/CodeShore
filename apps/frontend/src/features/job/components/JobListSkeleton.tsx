import { JOB_PAGE_SIZE } from '../queries';

// Job list loading skeleton (task 7.5), ported from JobListSkeleton.vue.
export function JobListSkeleton() {
  return (
    <div className="divide-y divide-[#001f2a]/[0.06]">
      {Array.from({ length: JOB_PAGE_SIZE }, (_, i) => (
        <div key={i} className="flex animate-pulse flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="bg-[#001f2a]/[0.08] h-4 w-1/2 rounded" />
            <div className="bg-[#001f2a]/[0.08] ml-auto h-3 w-3 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="bg-[#001f2a]/[0.08] h-3 w-24 rounded" />
            <div className="bg-[#001f2a]/[0.08] h-3 w-20 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="bg-[#001f2a]/[0.08] h-3 w-24 rounded" />
            <div className="bg-[#001f2a]/[0.08] ml-auto h-3 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
