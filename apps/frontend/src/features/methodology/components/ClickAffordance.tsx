/**
 * 關係圖「可點看詳細」節點的常駐可點提示。
 *
 * 取代過往「點選節點可看各步驟的角色與用途」這類說明文字：在每個可互動節點右側固定顯示一個
 * 箭號，平時為灰階、游標移上（父層加 `group`）或被選取（active）時轉為主色，讓節點本身就表達
 * 出可點擊；常駐圖示在觸控裝置同樣可見，不依賴 hover。父層另以 title 屬性提供桌面 hover 小字。
 */
export function ClickAffordance({ active }: { readonly active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-auto flex shrink-0 items-center transition-colors ${
        active ? 'text-[#003d92]' : 'text-[#9aa3b2] group-hover:text-[#003d92]'
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </span>
  );
}
