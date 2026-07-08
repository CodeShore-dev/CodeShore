// Requirement 10.2: 讓維運者可依時間範圍查詢歷史建議紀錄. Two plain `date`
// inputs (YYYY-MM-DD, already a valid ISO-8601 date string) next to
// `AiSuggestionReviewPage`'s existing target-table/status filter controls.
// Extracted into its own component to keep the page under the project's
// 200-line lint limit -- purely presentational, all state lives in the page.
interface SuggestionDateRangeFilterProps {
  createdAfter: string;
  createdBefore: string;
  onCreatedAfterChange: (value: string) => void;
  onCreatedBeforeChange: (value: string) => void;
}

export function SuggestionDateRangeFilter({
  createdAfter,
  createdBefore,
  onCreatedAfterChange,
  onCreatedBeforeChange,
}: SuggestionDateRangeFilterProps) {
  return (
    <>
      <label className="text-on-surface-variant flex items-center gap-1.5 text-sm">
        起始時間
        <input
          type="date"
          value={createdAfter}
          data-testid="filter-created-after"
          className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 px-2 text-sm"
          onChange={e => onCreatedAfterChange(e.target.value)}
        />
      </label>
      <label className="text-on-surface-variant flex items-center gap-1.5 text-sm">
        結束時間
        <input
          type="date"
          value={createdBefore}
          data-testid="filter-created-before"
          className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 px-2 text-sm"
          onChange={e => onCreatedBeforeChange(e.target.value)}
        />
      </label>
    </>
  );
}
