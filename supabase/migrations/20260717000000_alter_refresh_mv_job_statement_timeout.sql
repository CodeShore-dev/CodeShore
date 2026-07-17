-- `refresh_mv_job` was hitting "canceling statement due to statement timeout"
-- during REFRESH MATERIALIZED VIEW CONCURRENTLY on mv_job (heavy joins +
-- array_agg over job/job_tech/job_keyword). Raise the per-function statement
-- timeout so the refresh has room to finish.

ALTER FUNCTION public.refresh_mv_job() SET statement_timeout TO '10min';
