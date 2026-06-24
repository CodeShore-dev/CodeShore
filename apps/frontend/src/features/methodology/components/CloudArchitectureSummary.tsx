import type {
  ArchView,
  CloudArchitecture,
} from '../content/cloudArchitecture';

export interface CloudArchitectureSummaryProps {
  readonly architecture: CloudArchitecture;
}

/**
 * 雲端架構的文字等價摘要（degraded／無障礙路徑）。
 *
 * 一律存在於 DOM，當視覺關係圖無法繪製時即為降級後備內容，並提供輔助科技
 * 可讀的純文字。為每個視角輸出：視角標題、所用節點清單（含角色）與關係清單，
 * 全部由傳入的 architecture 資料推導，不寫死任何節點／邊內容。
 */
export function CloudArchitectureSummary({
  architecture,
}: CloudArchitectureSummaryProps): JSX.Element {
  const labelOf = (id: string): string =>
    architecture.nodes.find((node) => node.id === id)?.label ?? id;

  const roleOf = (id: string): string | undefined =>
    architecture.nodes.find((node) => node.id === id)?.detail?.role;

  const nodeIdsForView = (view: ArchView): readonly string[] => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const tier of view.tiers) {
      for (const id of tier) {
        if (!seen.has(id)) {
          seen.add(id);
          ordered.push(id);
        }
      }
    }
    return ordered;
  };

  const views = Object.values(architecture.views);

  return (
    <section
      aria-label="架構文字摘要"
      className="text-[#434653] text-sm leading-relaxed"
    >
      <h3 className="text-[#001f2a] font-semibold">架構文字摘要</h3>
      <p className="text-[#434653]">
        以下為雲端架構關係圖的文字等價內容，當視覺圖表無法顯示時可作為後備。
      </p>
      {views.map((view) => (
        <details key={view.id} className="border-[#001f2a]/10 border-t py-2">
          <summary className="text-[#001f2a] cursor-pointer font-medium">
            以文字描述：{view.title}
          </summary>
          <div className="mt-2 space-y-3">
            <h4 className="text-[#001f2a] font-semibold">{view.title}</h4>
            <section aria-label={`${view.title}・節點`}>
              <h4 className="text-[#001f2a] font-medium">節點</h4>
              <ul className="text-[#434653] list-disc pl-5">
                {nodeIdsForView(view).map((id) => {
                  const role = roleOf(id);
                  return (
                    <li key={id}>
                      {labelOf(id)}
                      {role ? `（${role}）` : ''}
                    </li>
                  );
                })}
              </ul>
            </section>
            <section aria-label={`${view.title}・關係`}>
              <h4 className="text-[#001f2a] font-medium">關係</h4>
              <ul className="text-[#434653] list-disc pl-5">
                {view.edges.map((edge) => (
                  <li key={`${edge.from}-${edge.to}-${edge.label ?? ''}`}>
                    {labelOf(edge.from)} → {labelOf(edge.to)}
                    {edge.label ? `（${edge.label}）` : ''}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </details>
      ))}
    </section>
  );
}
