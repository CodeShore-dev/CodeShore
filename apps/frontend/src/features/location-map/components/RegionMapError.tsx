// 地圖錯誤狀態元件（task 6.4，design.md「RegionMapError.tsx」／
// requirements.md 1.4：地圖資料載入失敗時須顯示錯誤狀態並提供重試操作）。
//
// 遵循 frontend-standards.md「空狀態固定結構」：大 icon → 標題（font-black）
// → 說明文 → 操作按鈕（比照 JobList.tsx 的空狀態排版與
// CurationSession.tsx 的「重試」按鈕／`#ba1a1a` 錯誤色慣例）。
export interface RegionMapErrorProps {
  onRetry: () => void;
}

export function RegionMapError({ onRetry }: RegionMapErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <span className="material-symbols-outlined mb-4 text-6xl text-[#ba1a1a]/60">
        error
      </span>
      <h2 className="mb-2 text-xl font-black text-[#001f2a]">地圖載入失敗</h2>
      <p className="mb-6 text-sm text-[#434653]">
        目前無法取得地區職缺分布資料，請稍後再試一次。
      </p>
      <button
        type="button"
        className="cursor-pointer rounded-xl bg-[#003d92] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1654b9] active:scale-95"
        onClick={onRetry}
      >
        重試
      </button>
    </div>
  );
}
