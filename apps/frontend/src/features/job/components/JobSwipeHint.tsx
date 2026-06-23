interface JobSwipeHintProps {
  onDismiss: () => void;
}

// Mobile swipe affordance hint (task 7.5), ported from JobSwipeHint.vue.
export function JobSwipeHint({ onDismiss }: JobSwipeHintProps) {
  return (
    <div className="relative mb-3 flex items-center gap-2 rounded-xl border border-[#c3c6d5] bg-white py-3 pt-4 pb-8 shadow-[0_24px_40px_rgba(0,31,42,0.06)] md:hidden">
      <div className="flex flex-1 items-center justify-center gap-5 pr-5">
        <div className="flex flex-col items-center gap-1 text-[#ba1a1a]">
          <span className="flex items-center">
            <span className="material-symbols-outlined animate-bounce-left">
              chevron_left
            </span>
            <span
              className="material-symbols-outlined text-4xl!"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              close
            </span>
          </span>
          <span className="text-[11px] font-bold whitespace-nowrap">
            左滑不喜歡
          </span>
        </div>

        <span className="text-[11px] font-bold tracking-widest text-[#434653]">
          滑動職缺卡片
        </span>

        <div className="flex flex-col items-center gap-1 text-[#003d92]">
          <span className="flex items-center">
            <span
              className="material-symbols-outlined text-4xl!"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              favorite
            </span>
            <span className="material-symbols-outlined animate-bounce-right">
              chevron_right
            </span>
          </span>
          <span className="text-[11px] font-bold whitespace-nowrap">
            右滑喜歡
          </span>
        </div>
      </div>
      <button
        type="button"
        className="absolute right-2 bottom-2 cursor-pointer text-[12px] text-[#434653] hover:text-[#001f2a]"
        onClick={onDismiss}
      >
        我知道了
      </button>
    </div>
  );
}
