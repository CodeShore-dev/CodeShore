-- Fixes date-bucketing in the crawl/update stats RPCs used by the admin
-- monitoring dashboard's 「每日更新統計」table and stat cards.
--
-- `job.crawled_at`/`created_at` are `timestamptz` storing correct absolute
-- UTC instants (see 20260718000000_split_job_crawled_updated_at.sql), but
-- `get_job_crawl_stats()` and `get_job_update_date_counts()` cast them to
-- `date` with bare `::date`, which resolves using the database session's
-- `TimeZone` GUC (UTC, since no project migration or config sets it). The
-- dashboard is used from Asia/Taipei (UTC+8), so any row crawled between
-- 00:00-07:59 Taipei time gets bucketed under the previous UTC calendar
-- day, making "today" appear to have zero rows until UTC midnight.
--
-- Fix: explicitly convert to Asia/Taipei before taking the date, in both
-- functions, everywhere a bucket/comparison date is derived.
CREATE OR REPLACE FUNCTION public.get_job_crawl_stats(p_days integer DEFAULT 7)
 RETURNS TABLE(new_jobs_date date, new_jobs_count bigint, updated_jobs_date date, updated_jobs_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  WITH bounds AS (
    SELECT
      max(created_at AT TIME ZONE 'Asia/Taipei')::date AS c_date,
      max(crawled_at AT TIME ZONE 'Asia/Taipei')::date AS u_date
    FROM job
  )
  SELECT
    b.c_date AS new_jobs_date,
    (SELECT count(*) FROM job WHERE (created_at AT TIME ZONE 'Asia/Taipei')::date >= b.c_date - p_days) AS new_jobs_count,
    b.u_date AS updated_jobs_date,
    (SELECT count(*) FROM job WHERE (crawled_at AT TIME ZONE 'Asia/Taipei')::date >= b.u_date - p_days) AS updated_jobs_count
  FROM bounds b;
$function$;

CREATE OR REPLACE FUNCTION public.get_job_update_date_counts()
 RETURNS TABLE(updated_date date, count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (crawled_at AT TIME ZONE 'Asia/Taipei')::date AS updated_date, count(*) AS count
  FROM job
  GROUP BY (crawled_at AT TIME ZONE 'Asia/Taipei')::date
  ORDER BY (crawled_at AT TIME ZONE 'Asia/Taipei')::date DESC;
$function$;
