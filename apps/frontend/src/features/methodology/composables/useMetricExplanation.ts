import { metricExplanations } from '../content/metrics';
import type {
  MetricExplanation,
  MetricKey,
} from '../content/types';

export interface UseMetricExplanation {
  /** 查無對應 key 時回傳 null（InfoHint 據此不渲染） */
  readonly explanation: MetricExplanation | null;
  /** 深連路徑，例：/methodology#database */
  readonly deepLink: string | null;
}

/**
 * 由 `MetricKey` 查表取得計算說明與深連目標。
 *
 * 純函式、同步、無副作用：直接查 `metricExplanations` 登錄表。
 * 命中時回傳該筆說明與 `/methodology#<anchor>` 深連；
 * 未登錄（執行期不存在對應項）則回傳 `{ explanation: null, deepLink: null }`。
 */
export function useMetricExplanation(
  metric: MetricKey,
): UseMetricExplanation {
  const explanation = metricExplanations[metric] ?? null;
  const deepLink =
    explanation === null
      ? null
      : `/methodology#${explanation.anchor}`;

  return { explanation, deepLink };
}
