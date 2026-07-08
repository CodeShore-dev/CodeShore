import {
  AiSuggestionStatus,
  AiSuggestionTargetTable,
  AiSuggestionWorkflow,
} from '@codeshore/data-types';

export const TARGET_TABLE_LABELS: Record<AiSuggestionTargetTable, string> = {
  job_description_bin: '排除用職缺描述清單',
  keyword_bin: '排除用關鍵字清單',
  tech: '技術字典',
  tech_keyword: '關鍵字對應技術',
  tech_parent: '技術父子階層',
  location_group: '地點群組',
  location_group_location: '地點字串對應地點群組',
};

export const WORKFLOW_LABELS: Record<AiSuggestionWorkflow, string> = {
  keyword_mapping: '關鍵字對應技術',
  tech_dictionary: '技術字典補全',
  tech_hierarchy: '技術父子階層',
  location_mapping: '地點正規化',
  noise_detection: '排除清單雜訊偵測',
};

export const STATUS_LABELS: Record<AiSuggestionStatus, string> = {
  pending: '待審',
  approved: '已核准',
  rejected: '已駁回',
};

export const ACTION_LABELS: Record<'insert' | 'update' | 'delete', string> = {
  insert: '新增',
  update: '修改',
  delete: '刪除',
};

export const TARGET_TABLE_OPTIONS = Object.entries(TARGET_TABLE_LABELS) as [
  AiSuggestionTargetTable,
  string,
][];

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [
  AiSuggestionStatus,
  string,
][];

export const WORKFLOW_OPTIONS = Object.entries(WORKFLOW_LABELS) as [
  AiSuggestionWorkflow,
  string,
][];
