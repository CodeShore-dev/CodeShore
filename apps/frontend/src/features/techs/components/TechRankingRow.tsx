import { useNavigate } from 'react-router';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWanInt } from '../../../utils/format';
import type { RankingMode } from '../hooks/useTechRanking';

interface TechRankingRowProps {
  item: SupabaseView.MvTechRanking;
  rank: number;
  mode: RankingMode;
}

const numField = (item: object, key: string): number =>
  (item as Record<string, number>)[key] ?? 0;

export function TechRankingRow({ item, rank, mode }: TechRankingRowProps) {
  const navigate = useNavigate();
  const isSalary = mode !== 'popular';
  const salaryType = mode === 'salary-month' ? 'month' : 'year';

  const goJobs = () =>
    navigate(`/jobs?${new URLSearchParams({ tags: item.tech })}`);

  return (
    <tr
      className="cursor-pointer border-b border-[#eef3f8] transition-colors last:border-0 hover:bg-[#f4faff]"
      onClick={goJobs}
    >
      <td className="px-4 py-3 font-mono text-xs text-[#434653]">#{rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <TechIcon slugs={item.icon_slugs} label={item.label} size={22} />
          <span className="font-black text-[#001f2a]">{item.label}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(item.tags ?? []).map(tag => (
            <span
              key={tag}
              className="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#434653]"
            >
              {TAG_LABEL_MAP[tag] ?? tag}
            </span>
          ))}
        </div>
      </td>
      {isSalary ? (
        <>
          <td className="px-4 py-3 text-right font-black text-[#003d92] tabular-nums">
            {toWanInt(numField(item, `${salaryType}_median_avg`))}萬
          </td>
          <td className="px-4 py-3 text-right font-black text-[#003d92] tabular-nums">
            {toWanInt(numField(item, `${salaryType}_pr75_avg`))}萬
          </td>
          <td className="px-4 py-3 text-right font-black text-[#003d92] tabular-nums">
            {toWanInt(numField(item, `${salaryType}_pr88_avg`))}萬
          </td>
        </>
      ) : (
        <td className="px-4 py-3 text-right font-black text-[#003d92] tabular-nums">
          {item.job_count.toLocaleString()}
        </td>
      )}
    </tr>
  );
}
