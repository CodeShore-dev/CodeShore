import { useRef } from 'react';

// Guards against transient negative values caused by independent async data
// sources resolving out of order (e.g. total job count still loading, so it
// reads as 0, while per-tab liked/disliked counts have already arrived --
// `openJobs - liked - disliked` briefly computes negative until openJobs
// catches up). Keeps the last known non-negative value until a new
// non-negative value arrives, instead of flashing a negative number.
export function useStableNonNegative(value: number): number {
  const stableRef = useRef(Math.max(value, 0));
  if (value >= 0) stableRef.current = value;
  return stableRef.current;
}
