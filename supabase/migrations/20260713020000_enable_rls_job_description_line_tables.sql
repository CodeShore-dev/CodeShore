-- Enables Row Level Security on `job_description_line` and
-- `job_description_line_keyword` (task 1.1/1.2 of the job-keyword-ai-review
-- feature), matching the repo-wide convention already applied to every
-- other public table (RLS enabled, no policies — access is enforced at the
-- NestJS layer via the Supabase service-role key, which bypasses RLS).
--
-- This was discovered and applied directly against the live Supabase
-- project (lsizfvkzpwxkwvohrkmn) via the Supabase MCP `apply_migration`
-- tool: the two CREATE TABLE migrations that precede this one did not
-- enable RLS, which would have left them as the only two tables in the
-- schema exposed via PostgREST without the default-deny RLS posture every
-- sibling table has. `pnpm db:sync` was re-run afterward.

ALTER TABLE public."job_description_line" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."job_description_line_keyword" ENABLE ROW LEVEL SECURITY;
