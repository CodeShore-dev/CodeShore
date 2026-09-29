import { Link } from 'react-router';

import { PageSeo } from '../../../components/PageSeo';
import { env } from '../../../config/env';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { HomeHandoff } from '../components/HomeHandoff';
import { HomeHero } from '../components/HomeHero';
import { HomeHighSalaryTech } from '../components/HomeHighSalaryTech';
import { HomeHotCombos } from '../components/HomeHotCombos';
import { HomePopularTech } from '../components/HomePopularTech';
import { HomeSalaryBenchmark } from '../components/HomeSalaryBenchmark';
import { HomeStatRow } from '../components/HomeStatRow';
import { useHomeComboTechs } from '../hooks/useHomeComboTechs';
import { useKeywordTechRanking } from '../hooks/useKeywordTechRanking';

export function HomePage() {
  // 「熱門技術」排行榜自己的資料，只給 HomePopularTech 用。
  const popularRanking = useKeywordTechRanking();
  // 技術組合的技術來源獨立：四個分類各取 5 個，不受上方分類切換影響。
  const comboTechs = useHomeComboTechs();

  return (
    <div className="w-full">
      <PageSeo
        title="台灣工程師求職市場分析"
        description="碼的 上岸了：爬完台灣各大人力銀行的工程師職缺，算薪水、算技術熱度、算共現組合。看完數據，請去原平台投履歷。"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: '碼的 上岸了',
            url: env.siteUrl,
            logo: `${env.siteUrl}/logo-512.png`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: '碼的 上岸了',
            url: env.siteUrl,
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${env.siteUrl}/jobs?tech={search_term_string}`,
              },
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />
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
            to="/techs?mode=combos"
            className="flex items-center gap-0.5 text-xs font-bold text-[#003d92] transition-colors hover:text-[#001f2a]"
          >
            更多
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
        <div className="mb-4 text-lg font-black text-[#001f2a]">
          <span className="text-[#003d92]">職缺裡最常同時出現的技術組合</span>
        </div>
        {comboTechs.items.map(item => (
          <HomeHotCombos
            key={item.tech}
            tech={item.tech}
            categoryLabel={CATEGORY_LABEL_MAP[item.category]}
          />
        ))}
      </section>
      <HomeHandoff />
    </div>
  );
}
