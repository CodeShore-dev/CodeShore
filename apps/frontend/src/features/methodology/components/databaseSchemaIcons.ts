import type { DbGroupId } from '../content/databaseSchema';

// 各群組框的顯示名稱、主題色（硬編色票）與代表圖示 slug。
export const GROUP_META: Record<
  DbGroupId,
  { readonly name: string; readonly hex: string; readonly slugs: readonly string[] }
> = {
  job: { name: '職缺核心', hex: '#3ECF8E', slugs: ['iconify:devicon:postgresql'] },
  tech: { name: '技術字典', hex: '#6366f1', slugs: ['iconify:mdi:chip'] },
  location: { name: '地點', hex: '#0891b2', slugs: ['iconify:mdi:map-marker-outline'] },
  pref: { name: '使用者偏好', hex: '#db2777', slugs: ['iconify:mdi:heart-outline'] },
  source: { name: '爬蟲來源', hex: '#ea580c', slugs: ['iconify:mdi:database-import-outline'] },
  // 物化視圖依關係分成四個子群組（與「資料正規化流程」圖的子群組同色，便於對照）。
  'mv-salary': { name: '物化視圖‧薪資', hex: '#0d9488', slugs: ['iconify:mdi:cash-multiple'] },
  'mv-job': { name: '物化視圖‧職缺', hex: '#0f766e', slugs: ['iconify:mdi:table-eye'] },
  'mv-tech': { name: '物化視圖‧技術', hex: '#4f46e5', slugs: ['iconify:mdi:table-eye'] },
  'mv-location': { name: '物化視圖‧地點', hex: '#be185d', slugs: ['iconify:mdi:map-outline'] },
  fn: { name: 'Function', hex: '#7c3aed', slugs: ['iconify:mdi:function-variant'] },
};

// 每個節點的代表圖示 slug（找不到時退回群組圖示）。只覆寫少數最具辨識度的物件，
// 其餘沿用群組圖示，維持整張圖視覺一致、不雜亂。
export const NODE_ICON_SLUGS: Record<string, readonly string[]> = {
  job: ['iconify:mdi:briefcase-outline'],
  company: ['iconify:mdi:office-building-outline'],
  job_keyword: ['iconify:mdi:tag-multiple-outline'],
  job_description_bin: ['iconify:mdi:text-box-outline'],
  tech: ['iconify:mdi:sitemap-outline'],
  keyword: ['iconify:mdi:book-open-variant-outline'],
  keyword_bin: ['iconify:mdi:filter-remove-outline'],
  tech_keyword: ['iconify:mdi:link-variant'],
  tech_parent: ['iconify:mdi:file-tree-outline'],
  job_tech: ['iconify:mdi:link-variant'],
  job_preference: ['iconify:mdi:thumbs-up-down-outline'],
  job_source: ['iconify:mdi:link-box-variant-outline'],
  job_source_url: ['iconify:mdi:progress-clock'],
};
