// 地圖載入中骨架屏（task 6.4，design.md「RegionMapSkeleton.tsx」／
// requirements.md 1.3：地圖資料尚未載入完成時不得顯示空白或錯誤畫面）。
//
// 遵循 frontend-standards.md 骨架屏規則：`bg-[#001f2a]/[0.08]` +
// `animate-pulse`（比照 JobCardSkeleton.tsx／JobListSkeleton.tsx 的色票與
// pulse 慣例），但形狀改為比照 RegionChoropleth 的地圖畫布比例
// （viewBox 800x600 ≒ 4:3）呈現一個地圖形狀的置放區塊，而非套用
// JobCardSkeleton 的文字列/chip 形狀。
export function RegionMapSkeleton() {
  return (
    <div
      data-testid="region-map-skeleton"
      className="animate-pulse rounded-xl bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
    >
      <div className="aspect-[4/3] w-full rounded-2xl bg-[#001f2a]/[0.08]" />
      <div className="mt-4 flex flex-wrap gap-2">
        {['w-16', 'w-20', 'w-14', 'w-24'].map((w, i) => (
          <div key={i} className={`h-5 rounded-full bg-[#001f2a]/[0.08] ${w}`} />
        ))}
      </div>
    </div>
  );
}
