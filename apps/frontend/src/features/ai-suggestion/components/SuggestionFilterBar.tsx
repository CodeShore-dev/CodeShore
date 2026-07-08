import {
  AiSuggestionStatus,
  AiSuggestionTargetTable,
} from '@codeshore/data-types';

import { STATUS_OPTIONS, TARGET_TABLE_OPTIONS } from '../constants';
import { SuggestionDateRangeFilter } from './SuggestionDateRangeFilter';

interface SuggestionFilterBarProps {
  targetTable: AiSuggestionTargetTable | '';
  onTargetTableChange: (value: AiSuggestionTargetTable | '') => void;
  status: AiSuggestionStatus | '';
  onStatusChange: (value: AiSuggestionStatus | '') => void;
  createdAfter: string;
  onCreatedAfterChange: (value: string) => void;
  createdBefore: string;
  onCreatedBeforeChange: (value: string) => void;
  count: number;
}

// The full filter row for `AiSuggestionReviewPage` (target table, status,
// and requirement 10.2's created_at time-range), split out of the page to
// keep it under this repo's `max-lines` lint limit -- same rationale as
// `SuggestionActions` being split out of `SuggestionCard`. Purely
// presentational; all filter state lives in the page.
export function SuggestionFilterBar({
  targetTable,
  onTargetTableChange,
  status,
  onStatusChange,
  createdAfter,
  onCreatedAfterChange,
  createdBefore,
  onCreatedBeforeChange,
  count,
}: SuggestionFilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-on-surface-variant text-sm font-semibold">篩選</span>
      <select
        value={targetTable}
        data-testid="filter-target-table"
        className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 pr-8 pl-2 text-sm"
        onChange={e =>
          onTargetTableChange(e.target.value as AiSuggestionTargetTable | '')
        }
      >
        <option value="">全部資料表</option>
        {TARGET_TABLE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={status}
        data-testid="filter-status"
        className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 pr-8 pl-2 text-sm"
        onChange={e => onStatusChange(e.target.value as AiSuggestionStatus | '')}
      >
        <option value="">全部狀態</option>
        {STATUS_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <SuggestionDateRangeFilter
        createdAfter={createdAfter}
        createdBefore={createdBefore}
        onCreatedAfterChange={onCreatedAfterChange}
        onCreatedBeforeChange={onCreatedBeforeChange}
      />
      <span className="text-on-surface-variant text-xs">共 {count} 筆</span>
    </div>
  );
}
