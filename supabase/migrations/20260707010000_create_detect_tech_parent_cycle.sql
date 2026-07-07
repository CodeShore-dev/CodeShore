-- Creates `detect_tech_parent_cycle(p_parent, p_child)`: the Postgres-side
-- half of task 1.4's CycleCheck validation hook for the AI database
-- maintenance workflow feature.
--
-- Source of truth for this DDL:
-- .kiro/specs/ai-database-maintenance-workflow/design.md
--   -> "ValidationHooks：CycleCheck / SimilarityCheck（Full Block）"
-- .kiro/specs/ai-database-maintenance-workflow/research.md
--   -> 設計決策 #5（循環偵測用遞迴 CTE 沿 tech_parent 邊查詢，效能與正確性
--      優於在應用層抓全表比對）
-- .kiro/specs/ai-database-maintenance-workflow/requirements.md
--   -> Requirement 4.2, 8.2
--
-- IMPORTANT: this is a reviewable, versioned artifact only. The sandbox this
-- migration was authored in has no live Supabase project available (no
-- Docker daemon, no remote project credentials), so it has NOT been applied
-- anywhere. A human must apply it to the real Supabase project (e.g. via
-- `supabase db push` or the SQL editor) and then re-run
-- `scripts/sync-supabase-schema.mjs` (`pnpm db:sync`) so that
-- `supabase/schema.sql` and the generated types in `libs/data-types`
-- reflect the live database.
--
-- Semantics: given a proposed new edge `(p_parent -> p_child)` in
-- `tech_parent(parent, child)`, answer whether adding it would close a
-- cycle. That is true exactly when `p_parent` is already reachable from
-- `p_child` by following existing `parent -> child` edges forward (i.e. a
-- path `p_child -> ... -> p_parent` already exists) -- including the
-- degenerate self-loop case `p_parent = p_child`.
--
-- Returns the conflicting path as `text[]` (starting at `p_child`, ending
-- with the newly-proposed `p_parent`) when a cycle would be formed, or
-- `NULL` when the proposed edge is safe to add. The `text[]` shape (rather
-- than a bare boolean) is chosen so the caller
-- (`apps/backend/src/features/ai-suggestion/validation/cycle-check.ts`) can
-- surface `CycleCheckResult.conflictPath` for a human reviewer without a
-- second round-trip.
CREATE OR REPLACE FUNCTION public.detect_tech_parent_cycle(p_parent text, p_child text)
 RETURNS text[]
 LANGUAGE sql
 STABLE
AS $function$
  WITH RECURSIVE reachable_from_child(node, path) AS (
    -- Base case: start the forward walk at p_child itself. If p_parent
    -- equals p_child this row alone (node = p_parent) already flags the
    -- self-loop case below.
    SELECT p_child, ARRAY[p_child]

    UNION ALL

    -- Recursive step: extend the path one existing tech_parent edge at a
    -- time. The `NOT tp.child = ANY(r.path)` guard stops the recursion from
    -- looping forever if the existing data already contains a cycle.
    SELECT tp.child, r.path || tp.child
    FROM tech_parent tp
    JOIN reachable_from_child r ON tp.parent = r.node
    WHERE NOT tp.child = ANY(r.path)
  )
  SELECT path || p_parent
  FROM reachable_from_child
  WHERE node = p_parent
  ORDER BY array_length(path, 1) ASC
  LIMIT 1;
$function$;
