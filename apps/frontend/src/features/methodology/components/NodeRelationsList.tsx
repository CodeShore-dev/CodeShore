import { TechIcon } from '../../../components/TechIcon';
import type { NodeRelation, NodeRelations } from './nodeRelations';

/**
 * 詳細面板中的「上下游關聯」區塊。
 *
 * 屬於次要資訊：以較小、較淡的文字與小圖示呈現，視覺權重明顯低於主要的「角色／用途」。
 * 列出指向本節點（上游）與本節點指向（下游）的節點，並附上該條箭頭線的 label。
 */
export function NodeRelationsList({ incoming, outgoing }: NodeRelations) {
  if (incoming.length === 0 && outgoing.length === 0) return null;
  return (
    <div className="mt-3 border-t border-[#e8eaf0] pt-2.5">
      <p className="mb-1.5 text-[11px] font-semibold text-[#9398a6]">關聯節點與連線</p>
      <div className="space-y-1">
        {incoming.length > 0 ? <RelationGroup title="指向本節點" items={incoming} /> : null}
        {outgoing.length > 0 ? <RelationGroup title="本節點指向" items={outgoing} /> : null}
      </div>
    </div>
  );
}

function RelationGroup({ title, items }: { readonly title: string; readonly items: readonly NodeRelation[] }) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-wide text-[#aab0bf]">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((r, i) => (
          <li key={`${r.direction}-${r.nodeId}-${i}`} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#5b6070] flex items-center gap-1.5">
              <TechIcon slugs={[...r.iconSlugs]} label={r.nodeLabel} size={14} hideIfNotFound={false} />
              {r.nodeLabel}
            </span>
            {r.edgeLabel ? (
              <span className="pl-6 truncate text-[11px] text-[#9aa3b2]">· {r.edgeLabel}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

