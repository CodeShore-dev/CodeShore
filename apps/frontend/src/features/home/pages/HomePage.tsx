import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { HomeHandoff } from '../components/HomeHandoff';
import { HomeHero } from '../components/HomeHero';
import { HomeHighSalaryTech } from '../components/HomeHighSalaryTech';
import { HomeHotCombos } from '../components/HomeHotCombos';
import { HomePopularTech } from '../components/HomePopularTech';
import { HomeSalaryBenchmark } from '../components/HomeSalaryBenchmark';
import { HomeStatRow } from '../components/HomeStatRow';
import { useKeywordTechRanking } from '../hooks/useKeywordTechRanking';

export function HomePage() {
  // The popular-tech ranking is owned here so its items both feed
  // HomePopularTech and seed the HomeHotCombos list (parity with the Vue
  // shared store instance).
  const popularRanking = useKeywordTechRanking();
  const [popularTechs, setPopularTechs] = useState<string[]>([]);

  useEffect(() => {
    setPopularTechs(prev => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const item of popularRanking.items) {
        if (!seen.has(item.tech)) {
          seen.add(item.tech);
          next.push(item.tech);
        }
      }
      return next.length === prev.length ? prev : next;
    });
  }, [popularRanking.items]);

  return (
    <div className="w-full">
      <HomeHero />
      <HomeStatRow />
      <HomeSalaryBenchmark />
      <HomePopularTech ranking={popularRanking} />
      <HomeHighSalaryTech type="year" />
      <HomeHighSalaryTech type="month" />
      <section className="mt-10">
        <div className="mb-2 flex items-baseline gap-3">
          <div className="text-xs font-bold tracking-[0.18em] text-[#434653]">熱門技術組合</div>
          <Link
            to="/techs/combos"
            className="flex items-center gap-0.5 text-xs font-bold text-[#003d92] transition-colors hover:text-[#001f2a]"
          >
            更多
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
        <div className="mb-4 text-lg font-black text-[#001f2a]">
          <span className="text-[#003d92]">職缺裡最常同時出現的技術組合</span>
        </div>
        {popularTechs.map(tech => (
          <HomeHotCombos key={tech} tech={tech} />
        ))}
      </section>
      <HomeHandoff />
    </div>
  );
}
