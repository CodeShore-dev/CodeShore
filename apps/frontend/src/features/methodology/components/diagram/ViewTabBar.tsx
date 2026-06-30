import type { DiagramViewBase } from './types';

export interface ViewTabBarProps<TView extends DiagramViewBase> {
  readonly views: readonly TView[];
  readonly selectedId: TView['id'];
  readonly onSelect: (id: TView['id']) => void;
  // 群組的無障礙標籤：流量／流程類用「切換視角」，分頁類（資料庫架構）用「切換分頁」。
  readonly ariaLabel: string;
}

/**
 * 關係圖區塊的視角切換列（pill 按鈕）。四個 methodology 區塊共用同一套樣式與行為，
 * 僅 aria-label 與視角集不同。
 */
export function ViewTabBar<TView extends DiagramViewBase>({
  views,
  selectedId,
  onSelect,
  ariaLabel,
}: ViewTabBarProps<TView>) {
  return (
    <div role="group" aria-label={ariaLabel} className="mb-3 flex flex-wrap gap-2">
      {views.map(view => {
        const selected = selectedId === view.id;
        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(view.id)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003d92] ${
              selected
                ? 'border-[#003d92] bg-[#003d92] text-white'
                : 'border-[#c3c6d5] bg-white text-[#434653] hover:bg-[#f4faff]'
            }`}
          >
            {view.title}
          </button>
        );
      })}
    </div>
  );
}
