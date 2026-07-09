import { Link } from 'react-router';

import { env } from '../config/env';
import { useNavLinks } from './hooks/useNavLinks';

const DATA_SOURCES = [
  { label: '104 人力銀行', src: 'https://104.com.tw' },
  { label: 'Cake', src: 'https://cake.me' },
];

const ABOUT_ITEMS = ['開源於 GitHub', '法律聲明', '聯絡我們'];

export function AppFooter() {
  const { footerLinks } = useNavLinks();

  return (
    <footer className="mt-16 border-t border-[#c3c6d5] bg-[#f4faff] pt-10 pb-6">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3 text-[22px] font-black tracking-[-0.04em] text-[#003d92]">
            碼的，上岸了
          </div>
          <p className="max-w-90 text-sm leading-relaxed text-[#434653]">
            一個工程師求職市場分析器。爬完台灣各大人力銀行的工程師 JD，
            算薪水、算技術熱度、算共現組合。看完數據，請去原平台投履歷。
          </p>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-bold tracking-[0.15em] text-[#434653]">
            資料來源
          </div>
          {DATA_SOURCES.map(item => (
            <a
              key={item.src}
              href={item.src}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 py-1 text-sm font-bold text-[#001f2a]"
            >
              {item.label}
              <span
                className="material-symbols-outlined text-sm text-[#434653]"
                style={{ fontSize: '14px' }}
              >
                open_in_new
              </span>
            </a>
          ))}
        </div>

        <div>
          <div className="mb-3 text-[11px] font-bold tracking-[0.15em] text-[#434653]">
            產品
          </div>
          {footerLinks.map(item => (
            <Link
              key={item.label}
              to={item.to}
              className="block py-1 text-sm font-bold text-[#001f2a] transition-colors hover:text-[#003d92]"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/methodology"
            className="block py-1 text-sm font-bold text-[#001f2a] transition-colors hover:text-[#003d92]"
          >
            公開透明
          </Link>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-bold tracking-[0.15em] text-[#434653]">
            關於
          </div>
          {ABOUT_ITEMS.map(item => (
            <div
              key={item}
              className="py-1 text-sm font-bold text-[#001f2a]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl items-center justify-between border-t border-dashed border-[#c3c6d5] px-6 pt-4 text-[11px] tracking-wider text-[#434653]">
        <div>© 2026 碼的 上岸了 · 「碼」不是錯字。</div>
        <div>{env.appVersion} · Built in Taipei</div>
      </div>
    </footer>
  );
}
