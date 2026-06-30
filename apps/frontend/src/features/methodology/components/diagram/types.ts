// 領域無關的關係圖共用型別。
//
// methodology 下四個關係圖區塊（雲端與 CI/CD 架構／資料來源與爬蟲／資料正規化流程／
// 資料庫架構）共享同一套「節點 + 視角」模型，差異僅在各自的群組鍵（provider／group）與
// 少數選配欄位（如 view.description、node.detail.hostKey）。這些基底型別抽出共同形狀，
// 讓泛型 composable／元件可一體適用；各 domain 的 content 型別自然是這些基底的擴充。

export interface DiagramEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface DiagramNodeDetail {
  readonly role: string;
  readonly usage: string;
}

// 所有關係圖節點的共同形狀（各 domain 再加上 group/provider 與 detail 擴充欄位）。
export interface DiagramNodeBase {
  readonly id: string;
  readonly label: string;
  readonly interactive: boolean;
  readonly detail?: DiagramNodeDetail;
}

// 所有視角的共同形狀（各 domain 再加上 clusterRows／description 等選配欄位）。
export interface DiagramViewBase {
  readonly id: string;
  readonly title: string;
  readonly tiers: readonly (readonly string[])[];
  readonly edges: readonly DiagramEdge[];
}

// content registry 的共同形狀：節點集、視角表與預設視角。
export interface DiagramRegistry<TNode extends DiagramNodeBase, TViewId extends string, TView extends DiagramViewBase> {
  readonly nodes: readonly TNode[];
  readonly views: Readonly<Record<TViewId, TView>>;
  readonly defaultView: TViewId;
}

// 群組框（band）的顯示中繼資料：名稱、主題色（硬編色票）與代表圖示 slug。
export interface GroupMeta {
  readonly name: string;
  readonly hex: string;
  readonly slugs: readonly string[];
}
