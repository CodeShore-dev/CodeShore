import { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP } from '../../../utils/constants';

interface TechCardMetaProps {
  group: SupabaseView.MvTech;
}

// Category / parent / keyword footer, extracted from TechCard to keep that
// component under the 200-line limit. Pure presentation, no local state.
export function TechCardMeta({ group }: TechCardMetaProps) {
  return (
    <div className="border-t border-[#c3c6d5]/20 px-5 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">
          分類
        </span>
        <span className="rounded-full bg-[#fd7700]/15 px-2 py-0.5 text-sm font-medium text-[#fd7700]">
          {group.category ? CATEGORY_LABEL_MAP[group.category] : ''}
        </span>
        {group.parents?.length ? (
          <>
            <span className="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">
              父層
            </span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-sm font-medium text-amber-500">
              {group.parents.join('、')}
            </span>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">
          關鍵字
        </span>
        {group.keywords?.length ? (
          group.keywords.map(kw => (
            <span
              key={kw}
              className="rounded-full bg-[#e6f6ff] px-2 py-0.5 text-sm text-[#003d92] dark:bg-[#003d92]/20 dark:text-[#a8d4f5]"
            >
              {kw}
            </span>
          ))
        ) : (
          <span className="text-sm text-[#434653]/50 italic dark:text-[#c3c6d5]/50">
            —
          </span>
        )}
      </div>
    </div>
  );
}
