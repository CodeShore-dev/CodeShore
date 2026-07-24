-- location-map (task 12.1): add mv_location_salary, mirroring mv_location_tech's
-- join structure (job x location_group_location x location_group), but
-- aggregating by salary_type instead of by tech. Only counts open
-- (closed = false) jobs, consistent with mv_location_tech/mv_location_group.
-- Inner joins through location_group_location/location_group naturally
-- exclude jobs whose raw location string has no mapped location_group
-- (requirement 7.2 -- no extra filtering needed for that exclusion).
--
-- NOTE: the base `job` table has no `avg_salary` column -- that value only
-- exists as a computed column on `mv_job` (job x mv_salary_range_multiplier).
-- Rather than depend on mv_job (which LEFT JOINs location_group and falls
-- back to the raw location string, which would break requirement 7.2's
-- exclusion of unmapped locations), this view inlines mv_job's exact
-- avg_salary formula against the same INNER JOIN structure used by
-- mv_location_tech, then averages that per-job value per (location, salary_type)
-- group.
CREATE MATERIALIZED VIEW public."mv_location_salary" AS
 SELECT lg.id AS location,
    j.salary_type,
    COALESCE(count(DISTINCT j.id), 0::bigint) AS job_count,
    avg(
      CASE
        WHEN j.min_salary > 0 AND j.max_salary < 9999999 THEN round((j.min_salary + j.max_salary)::numeric / 2.0, 0)
        WHEN j.min_salary > 0 AND j.max_salary = 9999999 THEN round(j.min_salary::numeric * (1.0 + mv.ratio) / 2.0, 0)
        ELSE NULL::numeric
      END
    ) AS avg_salary
   FROM job j
     JOIN location_group_location lgl ON lgl.location = j.location
     JOIN location_group lg ON lg.id = lgl.location_group
     LEFT JOIN mv_salary_range_multiplier mv ON j.salary_type = mv.salary_type
  WHERE j.closed = false
  GROUP BY lg.id, j.salary_type
 HAVING count(DISTINCT j.id) > 0;

CREATE UNIQUE INDEX ux_mv_location_salary_location_type
  ON public.mv_location_salary USING btree (location, salary_type);

-- SECURITY DEFINER / SET search_path included from the start, unlike
-- refresh_mv_location_tech()'s initial version, which omitted them and
-- required a follow-up migration to fix a "Function Search Path Mutable"
-- security advisory.
CREATE OR REPLACE FUNCTION public.refresh_mv_location_salary()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_location_salary;
END;
$function$;
