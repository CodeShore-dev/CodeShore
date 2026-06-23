interface JobHandoffCTAProps {
  detailLink: string | undefined;
}

// "Apply on the original platform" handoff (task 7.5, requirement 3.5),
// ported from JobHandoffCTA.vue.
export function JobHandoffCTA({ detailLink }: JobHandoffCTAProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border-2 border-[#003d92] p-5 sm:flex-row sm:items-center sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          準備好投履歷？
        </div>
        <div className="text-[15px] font-bold leading-snug text-[#001f2a]">
          我們不收履歷。請去{' '}
          <strong className="text-[#003d92]">原始職缺頁</strong> 投。
        </div>
        <div className="mt-1 truncate text-xs text-[#434653]">
          資料來源 · {detailLink}
        </div>
      </div>
      <a
        href={detailLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#003d92] px-5 py-3.5 text-sm font-black text-white no-underline transition-colors hover:bg-[#1654b9] active:scale-95"
      >
        前往原始職缺
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          open_in_new
        </span>
      </a>
    </div>
  );
}
