import type { DataFlowGroupId } from '../content/dataNormalization';

// 各群組框的顯示名稱、主題色（硬編色票）與代表圖示 slug。
export const GROUP_META: Record<
  DataFlowGroupId,
  { readonly name: string; readonly hex: string; readonly slugs: readonly string[] }
> = {
  raw: { name: '原始職缺', hex: '#0284c7', slugs: ['iconify:mdi:file-document-outline'] },
  cook: { name: '寫入時加工', hex: '#7c3aed', slugs: ['iconify:mdi:auto-fix'] },
  fact: { name: '事實資料表', hex: '#3ECF8E', slugs: ['iconify:devicon:postgresql'] },
  derive: { name: '事後加工', hex: '#ea580c', slugs: ['iconify:mdi:cog-sync-outline'] },
  derived: { name: '衍生資料表', hex: '#0891b2', slugs: ['iconify:devicon:postgresql'] },
  mv: { name: '物化視圖', hex: '#0d9488', slugs: ['iconify:mdi:table-eye'] },
};

// 每個節點的代表圖示 slug（找不到時退回群組圖示）。
export const NODE_ICON_SLUGS: Record<string, readonly string[]> = {
  'raw-job': ['iconify:mdi:briefcase-outline'],
  'parse-salary': ['iconify:mdi:cash-multiple'],
  'parse-keyword': ['iconify:mdi:tag-text-outline'],
  'tbl-job': ['iconify:devicon:postgresql'],
  'tbl-company': ['iconify:mdi:office-building-outline'],
  'tbl-job-keyword': ['iconify:mdi:tag-multiple-outline'],
  'kw-dict': ['iconify:mdi:book-open-variant-outline'],
  'tech-map': ['iconify:mdi:sitemap-outline'],
  'loc-group': ['iconify:mdi:map-marker-outline'],
  'tbl-keyword': ['iconify:mdi:format-list-bulleted'],
  'tbl-job-tech': ['iconify:mdi:link-variant'],
  'tbl-location-group': ['iconify:mdi:map-outline'],
  'mv-aggregate': ['iconify:mdi:table-large'],
};
