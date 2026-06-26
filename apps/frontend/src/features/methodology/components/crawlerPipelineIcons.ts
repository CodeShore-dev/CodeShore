import type { CrawlerGroupId } from '../content/crawlerPipeline';

// 各群組框的顯示名稱、主題色（硬編色票）與代表圖示 slug。
export const GROUP_META: Record<
  CrawlerGroupId,
  { readonly name: string; readonly hex: string; readonly slugs: readonly string[] }
> = {
  source: { name: '資料來源', hex: '#0284c7', slugs: ['iconify:mdi:briefcase-search-outline'] },
  engine: { name: '爬蟲引擎', hex: '#7c3aed', slugs: ['iconify:logos:puppeteer'] },
  'list-pipeline': { name: '抓取列表', hex: '#0891b2', slugs: ['iconify:mdi:format-list-bulleted-type'] },
  'list-pipeline-next': { name: '抓取下一頁列表', hex: '#0891b2', slugs: ['iconify:mdi:format-list-bulleted-type'] },
  'detail-pipeline': { name: '抓取詳細', hex: '#0d9488', slugs: ['iconify:mdi:file-document-multiple-outline'] },
  database: { name: '資料庫', hex: '#3ECF8E', slugs: ['iconify:devicon:postgresql'] },
  mode: { name: '執行模式', hex: '#ea580c', slugs: ['iconify:mdi:cog-play-outline'] },
};

// 每個節點的代表圖示 slug（找不到時退回群組圖示）。
export const NODE_ICON_SLUGS: Record<string, readonly string[]> = {
  'src-104': ['iconify:mdi:briefcase-outline'],
  'src-cake': ['iconify:mdi:cake-variant-outline'],
  'crawler-engine': ['iconify:logos:puppeteer'],
  stealth: ['iconify:mdi:incognito'],
  'list-api-intercept': ['iconify:mdi:radar'],
  'list-filter': ['iconify:mdi:filter-check-outline'],
  'list-next': ['iconify:carbon:connect-recursive'],
  'list-enqueue': ['iconify:mdi:playlist-plus'],
  'detail-extractor': ['iconify:mdi:file-document-outline'],
  normalizer: ['iconify:mdi:auto-fix'],
  'batch-upsert': ['iconify:mdi:database-import-outline'],
  'db-job': ['iconify:devicon:postgresql'],
  'db-job-source': ['iconify:mdi:database-clock-outline'],
  'mode-fresh': ['iconify:mdi:database-refresh-outline'],
  'mode-resume': ['iconify:mdi:step-forward'],
  'mode-recrawl': ['iconify:mdi:refresh'],
  'mode-recrawl-cond': ['iconify:mdi:filter-outline'],
  'mode-salary': ['iconify:mdi:cash-multiple'],
  'mode-keyword': ['iconify:mdi:tag-outline'],
};
