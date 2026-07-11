import { SupabaseView } from '@codeshore/data-types';

import type { RankingMode } from '../hooks/useTechRanking';
import { TechComboRow } from './TechComboRow';
import { TechRankingRow } from './TechRankingRow';

type TechsMode = RankingMode | 'combos';

interface TechsTableProps {
  mode: TechsMode;
  page: number;
  pageSize: number;
  rankingItems: SupabaseView.MvTechRanking[];
  comboItems: SupabaseView.MvTechComboStats[];
}

export function TechsTable({
  mode,
  page,
  pageSize,
  rankingItems,
  comboItems,
}: TechsTableProps) {
  const isCombos = mode === 'combos';

  return (
    <div className="overflow-x-auto rounded-xl border border-[#c9e7f7] bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#c9e7f7] bg-[#f4faff] text-xs text-[#434653]">
            <th className="px-4 py-3 font-bold">#</th>
            {isCombos ? (
              <>
                <th className="px-4 py-3 font-bold">父技術</th>
                <th className="px-4 py-3 font-bold">組合技術</th>
              </>
            ) : (
              <th className="px-4 py-3 font-bold">技術</th>
            )}
            <th className="px-4 py-3 font-bold">標籤</th>
            <th className="px-4 py-3 text-right font-bold">職缺數</th>
            <th className="px-4 py-3 text-right font-bold">年薪 PR50</th>
            <th className="px-4 py-3 text-right font-bold">年薪 PR75</th>
            <th className="px-4 py-3 text-right font-bold">年薪 PR88</th>
            <th className="px-4 py-3 text-right font-bold">月薪 PR50</th>
            <th className="px-4 py-3 text-right font-bold">月薪 PR75</th>
            <th className="px-4 py-3 text-right font-bold">月薪 PR88</th>
          </tr>
        </thead>
        <tbody>
          {mode === 'combos'
            ? comboItems.map((combo, i) => (
                <TechComboRow
                  key={`${combo.tech1}+${combo.tech2}`}
                  combo={combo}
                  rank={(page - 1) * pageSize + i + 1}
                />
              ))
            : rankingItems.map((item, i) => (
                <TechRankingRow
                  key={item.tech}
                  item={item}
                  rank={(page - 1) * pageSize + i + 1}
                  mode={mode}
                />
              ))}
        </tbody>
      </table>
    </div>
  );
}
