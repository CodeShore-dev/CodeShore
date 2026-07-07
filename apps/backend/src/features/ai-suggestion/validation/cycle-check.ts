import { getSupabaseClient } from '@codeshore/supabase';

/**
 * Result of checking whether adding a `(parent -> child)` edge to
 * `tech_parent` would form a cycle (Requirement 4.2, 8.2).
 *
 * See design.md "ValidationHooks：CycleCheck / SimilarityCheck（Full
 * Block）" for the exact interface this mirrors.
 */
export interface CycleCheckResult {
  hasCycle: boolean;
  conflictPath?: readonly string[];
}

/**
 * Checks whether proposing the new hierarchy edge `(parent -> child)` would
 * close a cycle against the existing `tech_parent` data.
 *
 * The actual graph walk happens in Postgres via the
 * `detect_tech_parent_cycle` function (see
 * `supabase/migrations/20260707010000_create_detect_tech_parent_cycle.sql`),
 * following the same `.rpc(...)` calling convention as
 * `libs/data-utils/src/lib/mv-refresh-all.ts`'s `refreshView`. That function
 * checks whether `parent` is already reachable from `child` by following
 * existing `parent -> child` edges forward; if so, a path
 * `child -> ... -> parent` already exists, so adding `parent -> child` would
 * close a loop.
 *
 * Any RPC-level error is thrown rather than swallowed -- a caller must not
 * be able to mistake "the check failed to run" for "the check ran and found
 * no cycle".
 */
export async function detectTechParentCycle(
  parent: string,
  child: string,
): Promise<CycleCheckResult> {
  const { data, error } = await getSupabaseClient().rpc(
    'detect_tech_parent_cycle',
    { p_parent: parent, p_child: child },
  );

  if (error) {
    throw new Error(
      `detect_tech_parent_cycle RPC failed: ${error.message ?? String(error)}`,
    );
  }

  const conflictPath = (data ?? null) as readonly string[] | null;
  if (!conflictPath || conflictPath.length === 0) {
    return { hasCycle: false };
  }
  return { hasCycle: true, conflictPath };
}
