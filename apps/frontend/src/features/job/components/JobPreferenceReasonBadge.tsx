interface JobPreferenceReasonBadgeProps {
  reason?: string;
}

// Small chip shown on a like/dislike list item for its sub-category
// (Requirement 7.7). Renders nothing without a reason so JobListItem can use
// it unconditionally on every tab, including 總數 where preference_reason is
// absent.
export function JobPreferenceReasonBadge({ reason }: JobPreferenceReasonBadgeProps) {
  if (!reason) return null;

  return <span className="rounded-md bg-[#c9e7f7] px-2 py-0.5 text-xs font-bold text-[#001f2a]">{reason}</span>;
}
