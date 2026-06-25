import type {
  ArchNode,
  ArchView,
  NodeStatus,
} from '../content/cloudArchitecture';

export interface CloudArchitectureDiagramProps {
  readonly view: ArchView;
  readonly nodes: readonly ArchNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

// 每個狀態的中文語意 + 視覺色點（硬編色票；Tailwind JIT 需字面 class，不可內插）。
const STATUS_META: Record<NodeStatus, { readonly label: string; readonly dot: string }> = {
  active: { label: '目前主力', dot: 'bg-[#003d92]' },
  alternative: { label: '可切換備選', dot: 'bg-[#fd7700]' },
  backup: { label: '備援', dot: 'bg-[#434653]' },
  shared: { label: '共用', dot: 'bg-[#1654b9]' },
};

/**
 * 雲端架構關係圖的視覺呈現（單一視角）。
 *
 * 以分層（tiers）呈現節點：行動裝置垂直堆疊、桌機水平多欄（flex-col / md:flex-row），
 * 大小裝置皆可閱讀。可互動節點以 <button> 呈現（滑鼠／觸控／鍵盤皆可操作），
 * 並以色點與 aria-label 同時傳達其角色（不單靠顏色）。關係（edges）以 ids→labels
 * 解析後逐條列於「關係連線」清單，表達節點之間的連線。
 */
export function CloudArchitectureDiagram({
  view,
  nodes,
  selectedNodeId,
  onSelectNode,
}: CloudArchitectureDiagramProps) {
  const nodeOf = (id: string): ArchNode | undefined =>
    nodes.find((node) => node.id === id);
  const labelOf = (id: string): string => nodeOf(id)?.label ?? id;

  const renderNode = (id: string) => {
    const node = nodeOf(id);
    if (node === undefined) {
      return null;
    }
    const meta = STATUS_META[node.status];
    const dot = (
      <span
        aria-hidden="true"
        className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
      />
    );
    const body = (
      <>
        {dot}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[#001f2a]">
            {node.label}
          </span>
          <span className="block text-[11px] text-[#434653]">{meta.label}</span>
        </span>
      </>
    );

    if (!node.interactive) {
      return (
        <div
          key={id}
          className="flex items-start gap-2 rounded-lg border border-[#c3c6d5] bg-white px-3 py-2"
        >
          {body}
        </div>
      );
    }

    const selected = selectedNodeId === node.id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={selected}
        aria-label={`${node.label} — ${meta.label}`}
        onClick={() => onSelectNode(node.id)}
        className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003d92] ${
          selected
            ? 'border-[#003d92] bg-[#d9f2ff]'
            : 'border-[#c3c6d5] bg-white hover:bg-[#f4faff]'
        }`}
      >
        {body}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={`雲端架構關係圖：${view.title}`}
      className="space-y-6"
    >
      <div
        data-testid="arch-tiers"
        className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-3"
      >
        {view.tiers.map((tier, tierIndex) => (
          <div
            key={tierIndex}
            className="flex flex-1 flex-col gap-3"
          >
            {tier.map((id) => renderNode(id))}
          </div>
        ))}
      </div>

      <div>
        <h4 className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 關係連線 · LINKS
        </h4>
        <ul
          aria-label="關係連線"
          className="space-y-1 text-sm leading-relaxed text-[#434653]"
        >
          {view.edges.map((edge) => (
            <li key={`${edge.from}-${edge.to}-${edge.label ?? ''}`}>
              {labelOf(edge.from)} → {labelOf(edge.to)}
              {edge.label ? `（${edge.label}）` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
