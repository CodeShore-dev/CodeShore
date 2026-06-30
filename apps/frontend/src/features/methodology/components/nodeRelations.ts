// 計算某節點在某視角中的「上下游關聯」：指向它的邊（上游）與它指向的邊（下游），
// 解析出對向節點的 label、圖示 slug 與該條箭頭線的 label，供詳細面板以次要資訊呈現。

export interface NodeRelation {
  readonly direction: 'in' | 'out';
  readonly edgeLabel?: string; // 箭頭線上的說明
  readonly nodeId: string;
  readonly nodeLabel: string;
  readonly iconSlugs: readonly string[];
}

export interface NodeRelations {
  readonly incoming: readonly NodeRelation[]; // 上游：指向本節點
  readonly outgoing: readonly NodeRelation[]; // 下游：本節點指向
}

interface RelationEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export function buildNodeRelations<TNode extends { readonly id: string; readonly label: string }>(
  nodeId: string,
  edges: readonly RelationEdge[],
  nodes: readonly TNode[],
  iconSlugsOf: (node: TNode) => readonly string[],
): NodeRelations {
  const byId = new Map(nodes.map(n => [n.id, n] as const));
  const relate = (otherId: string, direction: 'in' | 'out', edgeLabel?: string): NodeRelation | null => {
    const other = byId.get(otherId);
    if (!other) return null;
    return { direction, edgeLabel, nodeId: other.id, nodeLabel: other.label, iconSlugs: iconSlugsOf(other) };
  };

  const incoming: NodeRelation[] = [];
  const outgoing: NodeRelation[] = [];
  for (const edge of edges) {
    if (edge.to === nodeId) {
      const r = relate(edge.from, 'in', edge.label);
      if (r) incoming.push(r);
    }
    if (edge.from === nodeId) {
      const r = relate(edge.to, 'out', edge.label);
      if (r) outgoing.push(r);
    }
  }
  return { incoming, outgoing };
}
