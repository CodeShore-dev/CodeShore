-- Splits `job.updated_at` into two separate columns: `crawled_at` (last time
-- the crawler processed this job, regardless of whether content changed) and
-- a new `updated_at` (last time the job's content actually changed). Today
-- `updated_at` is bumped on every re-crawl even when nothing changed, which
-- makes the "updated" timestamp shown to job seekers meaningless and makes
-- it impossible for ops to tell whether a job's content really changed.
--
-- Requirement 1.1: Job 資料 shall 提供獨立的「爬取時間」欄位。
-- Requirement 1.2: Job 資料 shall 提供獨立的「異動時間」欄位。
-- Requirement 1.3: 既有資料遷移時，「爬取時間」初始值設為遷移前的 updated_at。
-- Requirement 1.4: 既有資料遷移時，「異動時間」初始值與「爬取時間」相同（逐列對應，
--   而非整表填入單一時間值）。
--
-- Source of truth for this DDL:
-- .kiro/specs/job-timestamp-separation/design.md
--   -> "6.1 Job Schema Migration" (steps 1-5)
-- .kiro/specs/job-timestamp-separation/research.md
--   -> "設計階段補充" -> "一次性 backfill 的正確寫法"
--
-- IMPORTANT: `ADD COLUMN ... DEFAULT now()` cannot be used here. `now()` is
-- volatile, so Postgres cannot take the metadata-only fast path and would
-- rewrite the whole table, giving every existing row the *same* ALTER-TABLE-
-- time value instead of each row's own prior `updated_at` value. That would
-- violate Requirement 1.4. Instead: add the column with no default, backfill
-- it row-by-row from `crawled_at`, set NOT NULL, and only then attach a
-- default for future inserts.
--
-- Note: this migration continues in the same file with mv_job / index
-- rebuilds (task 1.2) and the crawl-stats function updates (task 1.3).

-- Step 1: rename existing `updated_at` (crawl time) to `crawled_at`.
ALTER TABLE public."job" RENAME COLUMN "updated_at" TO "crawled_at";

-- Step 2: add the new `updated_at` (real content-change time) column
-- without a volatile default, so backfill below can set each row's own
-- value instead of every row getting the same ALTER-TABLE-time value.
ALTER TABLE public."job" ADD COLUMN "updated_at" timestamp with time zone;

-- Step 3: backfill every existing row's `updated_at` with its own
-- `crawled_at` value (row-by-row correlated assignment, not a literal).
UPDATE public."job" SET "updated_at" = "crawled_at";

-- Step 4: now that every row has a value, enforce NOT NULL.
ALTER TABLE public."job" ALTER COLUMN "updated_at" SET NOT NULL;

-- Step 5: attach a default for future inserts only (applied after backfill
-- and NOT NULL so it cannot affect the backfill above).
ALTER TABLE public."job" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');
