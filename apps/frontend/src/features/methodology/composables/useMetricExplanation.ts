import { metricExplanations } from '../content/metrics';
import type {
  MetricExplanation,
  MetricKey,
} from '../content/types';

export interface UseMetricExplanation {
  readonly explanation: MetricExplanation | null;
  readonly deepLink: string | null;
}

export function useMetricExplanation(
  metric: MetricKey,
): UseMetricExplanation {
  const explanation = metricExplanations[metric] ?? null;
  const deepLink =
    explanation === null
      ? null
      : explanation.sqlObjects.length > 0
        ? `/methodology#sql-${explanation.sqlObjects[0]}`
        : `/methodology#${explanation.anchor}`;

  return { explanation, deepLink };
}
