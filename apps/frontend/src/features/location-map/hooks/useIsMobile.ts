import { useEffect, useState } from 'react';

/** 對齊 Tailwind `md` 斷點（768px），低於此寬度視為行動裝置版面。 */
const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';

/**
 * 目前是否為行動裝置寬度（`RegionChoropleth` 用來決定是否啟用「縮放至
 * 北北基＋可拖曳」的行動裝置初始視角，見該元件的 `mobileInitialFocusIds`）。
 * 以 `matchMedia` 而非單次量測 `window.innerWidth` 實作，才能在使用者旋轉
 * 裝置或調整視窗寬度時即時反應斷點變化。
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const handleChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
