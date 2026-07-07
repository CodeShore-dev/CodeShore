/**
 * Pure-JS reimplementation of the recursive CTE traversal in
 * supabase/migrations/20260707010000_create_detect_tech_parent_cycle.sql.
 *
 * This mirrors the migration SQL's logic for local verification since no
 * live Postgres is available in this environment (no Docker daemon, no
 * remote project credentials -- see the migration file's header comment).
 * `cycle-check.spec.ts` mocks `.rpc(...)` and therefore never exercises the
 * real SQL, which is exactly how a bug in the SQL itself (a duplicated
 * terminal path element) previously slipped through review undetected.
 *
 * This is NOT a substitute for eventually running the real migration
 * against a live database -- it is only a way to make this exact bug class
 * (and the CTE's base-case / recursive-step / path-termination semantics)
 * reviewable and testable now.
 */

interface TechParentEdge {
  parent: string;
  child: string;
}

/**
 * Mirrors `reachable_from_child(node, path)` from the migration:
 *
 *   Base case:      node = p_child, path = [p_child]
 *   Recursive step: for every edge (parent -> child) where
 *                    edge.parent === r.node and edge.child is not already
 *                    in r.path, add node = edge.child,
 *                    path = r.path + [edge.child]
 *   Final SELECT:   among all rows where node === p_parent, return the
 *                    shortest path (ORDER BY array_length(path, 1) ASC
 *                    LIMIT 1). `path` already ends with `p_parent` by
 *                    construction at that point and must be returned as-is
 *                    -- NOT concatenated with `p_parent` again.
 *
 * Returns `null` when `p_parent` is not reachable from `p_child` (i.e. no
 * cycle would be formed by adding the proposed edge).
 */
function detectTechParentCycleSqlLogic(
  edges: readonly TechParentEdge[],
  pParent: string,
  pChild: string,
): readonly string[] | null {
  type Row = { node: string; path: readonly string[] };

  const allRows: Row[] = [{ node: pChild, path: [pChild] }];
  let frontier: readonly Row[] = allRows;

  while (frontier.length > 0) {
    const next: Row[] = [];
    for (const r of frontier) {
      for (const edge of edges) {
        if (edge.parent === r.node && !r.path.includes(edge.child)) {
          next.push({ node: edge.child, path: [...r.path, edge.child] });
        }
      }
    }
    allRows.push(...next);
    frontier = next;
  }

  const matches = allRows.filter((r) => r.node === pParent);
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => a.path.length - b.path.length);
  return matches[0].path;
}

describe('detectTechParentCycleSqlLogic (mirrors detect_tech_parent_cycle.sql)', () => {
  it('returns the conflict path exactly once, without duplicating the terminal element (regression for the fixed double-concatenation bug)', () => {
    // Existing edges a->b, b->c; proposed new edge (parent=c, child=a).
    // p_parent is reachable from p_child via a -> b -> c, so this would
    // close a cycle. The correct path is ['a', 'b', 'c'] -- NOT
    // ['a', 'b', 'c', 'c'], which is what the buggy `path || p_parent`
    // concatenation used to produce.
    const edges: TechParentEdge[] = [
      { parent: 'a', child: 'b' },
      { parent: 'b', child: 'c' },
    ];

    const result = detectTechParentCycleSqlLogic(edges, 'c', 'a');

    expect(result).toEqual(['a', 'b', 'c']);
    expect(result).not.toEqual(['a', 'b', 'c', 'c']);
  });

  it('returns null when the proposed edge would not close a cycle', () => {
    const edges: TechParentEdge[] = [{ parent: 'a', child: 'b' }];

    const result = detectTechParentCycleSqlLogic(edges, 'c', 'a');

    expect(result).toBeNull();
  });

  it('handles the degenerate self-loop case (p_parent === p_child)', () => {
    const result = detectTechParentCycleSqlLogic([], 'x', 'x');

    expect(result).toEqual(['x']);
  });

  it('returns the shortest conflicting path when multiple paths exist', () => {
    // a -> d directly, and a -> b -> d via a longer route. Proposed edge
    // (parent=d, child=a) should report the shorter path.
    const edges: TechParentEdge[] = [
      { parent: 'a', child: 'd' },
      { parent: 'a', child: 'b' },
      { parent: 'b', child: 'd' },
    ];

    const result = detectTechParentCycleSqlLogic(edges, 'd', 'a');

    expect(result).toEqual(['a', 'd']);
  });
});
