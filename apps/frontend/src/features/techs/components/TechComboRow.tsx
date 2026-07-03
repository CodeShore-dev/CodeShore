import { useNavigate } from 'react-router';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWan } from '../../../utils/format';

interface TechComboRowProps {
  combo: SupabaseView.MvTechComboStats;
  rank: number;
}

export function TechComboRow({ combo, rank }: TechComboRowProps) {
  const navigate = useNavigate();

  const goJobs = () =>
    navigate(
      `/jobs?${new URLSearchParams({ tags: `${combo.tech1},${combo.tech2}` })}`,
    );

  return (
    <tr
      className="cursor-pointer border-b border-[#eef3f8] transition-colors last:border-0 hover:bg-[#f4faff]"
      onClick={goJobs}
    >
      <td className="px-4 py-3 font-mono text-xs text-[#434653]">#{rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <TechIcon
            slugs={combo.tech1_icons}
            label={combo.tech1_label}
            size={22}
          />
          <span className="font-black text-[#001f2a]">
            {combo.tech1_label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <TechIcon
            slugs={combo.tech2_icons}
            label={combo.tech2_label}
            size={22}
          />
          <span className="font-black text-[#001f2a]">
            {combo.tech2_label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(combo.tech2_tags ?? []).map(tag => (
            <span
              key={tag}
              className="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#434653]"
            >
              {TAG_LABEL_MAP[tag] ?? tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-black text-[#003d92] tabular-nums">
        {combo.job_count.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right font-bold text-[#434653] tabular-nums">
        {toWan(combo.median_min_year)}–{toWan(combo.median_max_year)}
      </td>
      <td className="px-4 py-3 text-right font-bold text-[#434653] tabular-nums">
        {toWan(combo.median_min_month)}–{toWan(combo.median_max_month)}
      </td>
    </tr>
  );
}
