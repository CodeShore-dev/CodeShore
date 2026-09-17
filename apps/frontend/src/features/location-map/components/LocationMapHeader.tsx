/**
 * 地圖頁面標題區塊：eyebrow + 大標題。抽成獨立元件以維持
 * `LocationMapPage.tsx` 在 `frontend-standards.md` 的 200 行元件上限內。
 *
 * 「目前檢視」徽章已移除：技術視角（viewMode）整個功能下線後，地圖著色
 * 依據永遠是職缺數，徽章不再傳達任何資訊。
 */
export function LocationMapHeader() {
  return (
    <>
      <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
        ● 地區地圖 · LOCATION MAP
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
          職缺地圖
        </h1>
      </div>
    </>
  );
}
