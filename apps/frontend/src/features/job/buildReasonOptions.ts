import { SupabaseFunction } from '@codeshore/data-types';
import { DEFAULT_PREFERENCE_REASON } from '@codeshore/shared-utils';

export type ReasonCount = SupabaseFunction.JobPreferenceReasonCount;

export interface ReasonOption {
  reason: string;
  jobCount: number; // 0 for draft names
  isDraft: boolean;
  deletable: boolean; // false for the default reason
}

// Combines the server-known reasons with not-yet-confirmed draft names typed
// in the dialog into the single option list the picker renders. The default
// reason always exists and is always first (Requirements 2.3, 3.3); every
// other name -- server or draft -- is sorted together by job count, most
// first, and by zh-Hant name between equal counts (3.3). A draft has no jobs
// yet, so drafts land last. A draft that collides with a server name or with
// the default is dropped in favor of the existing item (4.5), and drafts
// collapse amongst themselves too. Only the default is non-deletable
// (5.1, 5.6).
export function buildReasonOptions(
  server: ReasonCount[],
  drafts: string[],
): ReasonOption[] {
  const serverByReason = new Map(server.map((item) => [item.reason, item]));

  const defaultServerEntry = serverByReason.get(DEFAULT_PREFERENCE_REASON);
  const defaultOption: ReasonOption = {
    reason: DEFAULT_PREFERENCE_REASON,
    jobCount: defaultServerEntry?.job_count ?? 0,
    isDraft: false,
    deletable: false,
  };

  const otherOptions = new Map<string, ReasonOption>();

  for (const item of server) {
    if (item.reason === DEFAULT_PREFERENCE_REASON) {
      continue;
    }
    otherOptions.set(item.reason, {
      reason: item.reason,
      jobCount: item.job_count,
      isDraft: false,
      deletable: true,
    });
  }

  for (const draft of drafts) {
    if (draft === DEFAULT_PREFERENCE_REASON || otherOptions.has(draft)) {
      continue;
    }
    otherOptions.set(draft, {
      reason: draft,
      jobCount: 0,
      isDraft: true,
      deletable: true,
    });
  }

  const sortedOthers = [...otherOptions.values()].sort(
    (a, b) =>
      b.jobCount - a.jobCount || a.reason.localeCompare(b.reason, 'zh-Hant'),
  );

  return [defaultOption, ...sortedOthers];
}
