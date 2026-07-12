/**
 * 「Keyword 策展流程」關係圖的唯一可信來源（content registry）。
 *
 * 以與其他四個 methodology 關係圖區塊相同的模式呈現：節點依群組框起來、節點間以箭頭表達
 * 關係。與其他四個區塊不同的是，本流程只有單一視角（策展流程本身就是一條含分支的固定路徑，
 * 不像爬蟲有「新增／更新」兩種模式），因此只定義一個 view，容器端不需要 ViewTabBar。
 *
 * 對齊 `apps/backend/src/features/keyword-curation/graph.ts` 實際的 LangGraph 5 個節點與
 * `routeByDecision` 條件邊：fetchContext → classify（AI 分類＋interrupt 人工決策關卡）→
 * 依 humanDecision.path 分派至 commitMapping（A）／validateAndCommitNewTech（B）／
 * commitKeywordBin（C）。僅描述架構與角色，不含任何機密或可重現受保護操作的設定。
 * 語系：zh-TW。
 */

export type CurationFlowGroupId = 'context' | 'decision' | 'commit';
export type CurationFlowViewId = 'flow';

export interface CurationFlowNode {
  readonly id: string;
  readonly label: string;
  readonly group: CurationFlowGroupId;
  readonly interactive: boolean;
  readonly detail?: {
    readonly role: string;
    readonly usage: string;
  };
}

export interface CurationFlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface CurationFlowView {
  readonly id: CurationFlowViewId;
  readonly title: string;
  readonly tiers: readonly (readonly string[])[];
  readonly clusterRows: readonly (readonly CurationFlowGroupId[])[];
  readonly edges: readonly CurationFlowEdge[];
}

export interface CurationFlow {
  readonly nodes: readonly CurationFlowNode[];
  readonly views: Readonly<Record<CurationFlowViewId, CurationFlowView>>;
  readonly defaultView: CurationFlowViewId;
}

export const keywordCurationFlow: CurationFlow = {
  nodes: [
    {
      id: 'fetchContext',
      label: '載入背景資料',
      group: 'context',
      interactive: true,
      detail: {
        role: '策展流程的起手式',
        usage:
          '取得目前完整的技術字典清單，並計算此關鍵字出現在多少職缺描述中，兩者都會交給下一步的 AI 分類使用。',
      },
    },
    {
      id: 'classify',
      label: 'AI 分類與人工決策關卡',
      group: 'decision',
      interactive: true,
      detail: {
        role: 'AI 判斷 + 暫停等待管理員決策',
        usage:
          '呼叫 AI 分類器，取得路徑 A／B／C 的建議與信心分數後，流程立即暫停（LangGraph interrupt），將完整建議呈現給管理員；管理員確認或覆寫決策後，流程才會依決策結果繼續往下走到對應的資料庫寫入步驟。',
      },
    },
    {
      id: 'commitMapping',
      label: '映射至既有技術條目',
      group: 'commit',
      interactive: true,
      detail: {
        role: '路徑 A 的資料庫寫入',
        usage: '將此關鍵字對應到管理員確認的既有技術條目，寫入 tech_keyword 映射表。',
      },
    },
    {
      id: 'validateAndCommitNewTech',
      label: '建立新技術條目',
      group: 'commit',
      interactive: true,
      detail: {
        role: '路徑 B 的資料庫寫入',
        usage:
          '先檢查提案的技術父子關聯是否會造成循環、新技術 id 是否已存在；驗證通過後才依序寫入技術條目、關鍵字映射與父子階層，任一步驟失敗仍會繼續其餘步驟並個別記錄結果。',
      },
    },
    {
      id: 'commitKeywordBin',
      label: '移入 keyword bin',
      group: 'commit',
      interactive: true,
      detail: {
        role: '路徑 C 的資料庫寫入',
        usage: '將此關鍵字標記為雜訊，寫入 keyword_bin，往後不會再出現在待策展清單中。',
      },
    },
  ],
  views: {
    flow: {
      id: 'flow',
      title: '策展流程',
      tiers: [
        ['fetchContext'],
        ['classify'],
        ['commitMapping', 'validateAndCommitNewTech', 'commitKeywordBin'],
      ],
      clusterRows: [['context'], ['decision'], ['commit']],
      edges: [
        { from: 'fetchContext', to: 'classify', label: '技術清單／職缺數' },
        { from: 'classify', to: 'commitMapping', label: '路徑 A' },
        { from: 'classify', to: 'validateAndCommitNewTech', label: '路徑 B' },
        { from: 'classify', to: 'commitKeywordBin', label: '路徑 C' },
      ],
    },
  },
  defaultView: 'flow',
};
