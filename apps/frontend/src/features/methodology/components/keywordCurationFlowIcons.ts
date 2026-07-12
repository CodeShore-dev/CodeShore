import type { CurationFlowGroupId } from '../content/keywordCurationFlow';

// 各群組框的顯示名稱、主題色（硬編色票）與代表圖示 slug。
export const GROUP_META: Record<
  CurationFlowGroupId,
  { readonly name: string; readonly hex: string; readonly slugs: readonly string[] }
> = {
  context: { name: '準備資料', hex: '#0284c7', slugs: ['iconify:mdi:database-search-outline'] },
  decision: { name: 'AI 分類與人工決策', hex: '#ca8a04', slugs: ['iconify:mdi:robot-outline'] },
  commit: { name: '資料庫寫入', hex: '#0891b2', slugs: ['iconify:mdi:database-import-outline'] },
};

// 每個節點的代表圖示 slug（找不到時退回群組圖示）。
export const NODE_ICON_SLUGS: Record<string, readonly string[]> = {
  fetchContext: ['iconify:mdi:database-search-outline'],
  classify: ['iconify:mdi:robot-outline'],
  commitMapping: ['iconify:mdi:link-variant'],
  validateAndCommitNewTech: ['iconify:mdi:shape-plus-outline'],
  commitKeywordBin: ['iconify:mdi:delete-outline'],
};
