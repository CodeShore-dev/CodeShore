import { Outlet } from 'react-router';

import { AppFooter } from '../layout/AppFooter';
import { AppMobileNav } from '../layout/AppMobileNav';
import { AppNavBar } from '../layout/AppNavBar';
import { ScrollManager } from './ScrollManager';

// App shell (task 3.2) — the App.vue equivalent. Hosts the global scroll
// manager, the top banner + nav, the routed content outlet, footer, and the
// mobile bottom nav. Used as the route-tree root in task 10.1.
export function RootLayout() {
  return (
    <div className="bg-background font-body text-on-surface min-h-screen">
      <ScrollManager />

      <div className="fixed top-0 z-50 w-full">
        <div className="hidden bg-[#001f2a] text-xs font-bold tracking-wider text-[#f4faff] md:block">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-1.5">
            <span>
              <span className="text-[#fd7700]">● </span>
              我們不會取代任何職缺平台。看完分析後，請透過連結自行回原站投遞履歷。
            </span>
            <span className="font-medium text-white/50">資料每週自動更新</span>
          </div>
        </div>
        <AppNavBar />
      </div>

      <main className="mx-auto flex max-w-7xl flex-col items-center px-4 pt-20 pb-24 md:pt-27 md:pb-12 lg:px-6">
        <Outlet />
      </main>

      <AppFooter />
      <AppMobileNav />
    </div>
  );
}
