import { getSupabaseClient } from '@codeshore/supabase';

import { resetJobKeywords_Keywords_JobTech } from './data-utils';

export type MvRefreshEvent =
  | { type: 'log'; step: string; message: string }
  | { type: 'error'; step: string; message: string }
  | { type: 'done'; success: boolean };

interface MvRefreshStep {
  id: string;
  label: string;
  run: () => Promise<void>;
}

async function refreshView(view: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc(`refresh_${view}`);
  if (error) throw new Error(error.message ?? String(error));
}

// 依 apps/frontend/src/features/methodology/content/databaseSchema.ts 的
// matview 分層（tier0 來源 → tier1 一級 mv → tier2 二級 mv）排出的執行順序。
// keyword_group_reset（/api/keyword/group/reset 背後邏輯）安插在 mv_tech 之後：
// 它靠 mv_tech 取得目前的技術/關鍵字字典來重建 job_keyword，並在結束前二次
// 刷新 mv_tech；其餘依賴 job_tech／job_keyword 的二級 mv 因此排在它之後執行。
const PIPELINE: MvRefreshStep[] = [
  {
    id: 'mv_salary_range_multiplier',
    label: '薪資範圍倍率',
    run: () => refreshView('mv_salary_range_multiplier'),
  },
  {
    id: 'mv_tech',
    label: '技術彙總',
    run: () => refreshView('mv_tech'),
  },
  {
    id: 'keyword_group_reset',
    label: '重建關鍵字字典（job_keyword／keyword／job_tech，並二次刷新 mv_tech）',
    run: () => resetJobKeywords_Keywords_JobTech(),
  },
  {
    id: 'mv_job',
    label: '對外職缺視圖',
    run: () => refreshView('mv_job'),
  },
  {
    id: 'mv_company',
    label: '公司彙總',
    run: () => refreshView('mv_company'),
  },
  {
    id: 'mv_company_tech',
    label: '公司技術彙總',
    run: () => refreshView('mv_company_tech'),
  },
  {
    id: 'mv_salary_type_median_ratio',
    label: '薪資基準（PR50／PR75／PR88）',
    run: () => refreshView('mv_salary_type_median_ratio'),
  },
  {
    id: 'mv_tech_combo_stats',
    label: '技術組合統計',
    run: () => refreshView('mv_tech_combo_stats'),
  },
  {
    id: 'mv_tech_ranking',
    label: '技術排行',
    run: () => refreshView('mv_tech_ranking'),
  },
  {
    id: 'mv_tech_category',
    label: '技術分類計數',
    run: () => refreshView('mv_tech_category'),
  },
  {
    id: 'mv_tech_tags',
    label: '技術標籤計數',
    run: () => refreshView('mv_tech_tags'),
  },
  {
    id: 'mv_location_group',
    label: '地點分布',
    run: () => refreshView('mv_location_group'),
  },
];

// 供 API 層驗證／下拉選單使用的合法步驟 id 清單（含 keyword_group_reset）。
export const MV_REFRESH_STEP_IDS: readonly string[] = PIPELINE.map(
  s => s.id,
);

export interface RefreshAllMaterializedViewsOptions {
  // 從此步驟 id 開始接續執行（略過此 id 之前、已成功跑完的步驟）。
  // 找不到對應 id 時視同從頭開始。
  fromStep?: string;
}

// 依序刷新所有物化視圖並在中途重建關鍵字字典，逐步 yield 進度事件供 SSE 轉發。
// 任一步驟失敗即中止並回報是哪一支失敗，不繼續往下跑；下次呼叫可帶入該步驟 id
// 作為 fromStep 從失敗處接續，不必重跑前面已成功的步驟。
export async function* refreshAllMaterializedViews(
  options?: RefreshAllMaterializedViewsOptions,
): AsyncGenerator<MvRefreshEvent> {
  const total = PIPELINE.length;
  const foundIndex = options?.fromStep
    ? PIPELINE.findIndex(s => s.id === options.fromStep)
    : 0;
  const startIndex = foundIndex >= 0 ? foundIndex : 0;

  if (startIndex > 0) {
    yield {
      type: 'log',
      step: PIPELINE[startIndex].id,
      message: `從第 ${startIndex + 1}/${total} 支接續執行（略過前面已完成的步驟）…`,
    };
  }

  for (let i = startIndex; i < total; i++) {
    const step = PIPELINE[i];
    yield {
      type: 'log',
      step: step.id,
      message: `[${i + 1}/${total}] 開始執行 ${step.id}（${step.label}）…`,
    };
    try {
      await step.run();
    } catch (err: any) {
      yield {
        type: 'error',
        step: step.id,
        message: `${step.id} 執行失敗：${err?.message ?? String(err)}`,
      };
      yield { type: 'done', success: false };
      return;
    }
    yield {
      type: 'log',
      step: step.id,
      message: `[${i + 1}/${total}] ${step.id} 完成`,
    };
  }
  yield { type: 'done', success: true };
}
