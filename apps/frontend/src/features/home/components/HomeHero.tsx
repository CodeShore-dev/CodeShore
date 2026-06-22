import { useEffect, useState } from 'react';

import { useHomeData } from '../hooks/useHomeData';

const CYCLE_ITEMS = [
  { is: '搞懂現在缺什麼技術', isNot: '投履歷的入口' },
  { is: '抓住薪資甜蜜點', isNot: '人才媒合的地方' },
  { is: '偷看大公司的技術清單', isNot: '履歷優化工具' },
];

export function HomeHero() {
  const { jobCountText } = useHomeData();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % CYCLE_ITEMS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="border-b border-[#c3c6d5] py-10">
      <h1
        className="m-0 leading-[0.92] font-black tracking-tighter text-[#001f2a]"
        style={{ fontSize: 'clamp(3.5rem, 8vw, 6rem)' }}
      >
        <span className="text-[#003d92]">碼的</span>，<br />
        <span className="text-[#fd7700]">上岸</span>了！
      </h1>
      <div className="mt-8 grid grid-cols-1 items-end gap-6 md:grid-cols-[1.4fr_1fr] md:gap-12">
        <div className="m-0 max-w-140 text-base font-medium text-[#001f2a] md:text-xl">
          <div className="flex items-center gap-2 leading-snug">
            <span>我們可以讓你</span>
            <strong className="font-black text-[#003d92]">
              {CYCLE_ITEMS[index].is}
            </strong>
          </div>
          <div className="flex items-center gap-2 leading-snug">
            <span>但不是另一個</span>
            <del className="text-[#fd7700]">{CYCLE_ITEMS[index].isNot}</del>
          </div>
          <p className="mt-4 mb-0 leading-relaxed">
            每週同步各大人力銀行職缺，讓你看清楚市場在要什麼、願意給多少。
          </p>
        </div>
        <div className="border-l-4 border-[#003d92] pl-5">
          <div
            className="leading-none font-black tracking-[-0.03em] text-[#003d92] tabular-nums"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)' }}
          >
            {jobCountText.total}
          </div>
          <div className="mt-1 text-sm font-bold tracking-widest text-[#434653]">
            個職缺(含關閉職缺)
          </div>
        </div>
      </div>
    </section>
  );
}
