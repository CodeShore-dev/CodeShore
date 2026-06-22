import { KeywordTechRankingCardList } from '../../../components/KeywordTechRankingCardList';
import { toWanInt } from '../../../utils/format';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useHomeData } from '../hooks/useHomeData';
import { useKeywordTechRanking } from '../hooks/useKeywordTechRanking';

interface HomeHighSalaryTechProps {
  type: 'month' | 'year';
}

const TITLE_MAP = {
  month: '高薪技術(月薪)',
  year: '高薪技術(年薪)',
};

const numField = (
  item: object,
  key: string,
): number => (item as Record<string, number>)[key] ?? 0;

export function HomeHighSalaryTech({ type }: HomeHighSalaryTechProps) {
  const { salaryBenchmarks } = useHomeData();

  const { items, getItems, loading } = useKeywordTechRanking({
    where: {
      $or: {
        [`${type}_median_avg`]: {
          gte: salaryBenchmarks[type].median,
        },
      },
    },
    orders: `${type}_median_avg:desc`,
  });

  return (
    <KeywordTechRankingCardList
      title={TITLE_MAP[type]}
      items={items}
      loading={loading}
      getItems={getItems}
      moreTo={`/techs?mode=salary-${type}`}
      titleHint={
        <InfoHint
          metric={
            type === 'year'
              ? 'home.highSalaryTech.year'
              : 'home.highSalaryTech.month'
          }
        />
      }
      renderMetric={item => (
        <div className="flex flex-col gap-1.5">
          {[
            { suffix: 'median_avg', tag: 'PR50', size: 'text-lg' },
            { suffix: 'pr75_avg', tag: 'PR75', size: 'text-sm' },
            { suffix: 'pr88_avg', tag: 'PR88', size: 'text-xs' },
          ].map(row => (
            <div
              key={row.tag}
              className={`flex items-center justify-between gap-1 ${row.size}`}
            >
              <span className="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums">
                {toWanInt(numField(item, `${type}_${row.suffix}`))}
                <span className="text-[0.875rem] font-black text-[#434653]">
                  萬
                </span>
              </span>
              <span className="flex items-baseline gap-1 text-[11px] font-bold text-[#434653]">
                <span className="font-mono text-[10px] tracking-widest">
                  {row.tag}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    />
  );
}
