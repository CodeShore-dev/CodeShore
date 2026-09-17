-- location-map (task 1.1): add mv_location_tech, mirroring mv_company_tech's
-- join structure (supabase/schema.sql "add_mv_company_tech" pattern), but
-- aggregating job_tech by location_group instead of by company. Only counts
-- open (closed = false) jobs, consistent with mv_company/mv_location_group.
-- Inner joins through location_group_location/location_group naturally
-- exclude jobs whose raw location string has no mapped location_group
-- (requirement 7.2 -- no extra filtering needed for that exclusion).
CREATE MATERIALIZED VIEW public."mv_location_tech" AS
 SELECT lg.id AS location,
    jkg.tech,
    COALESCE(count(DISTINCT j.id), 0::bigint) AS job_count
   FROM job j
     JOIN location_group_location lgl ON lgl.location = j.location
     JOIN location_group lg ON lg.id = lgl.location_group
     JOIN job_tech jkg ON jkg.job_id = j.id
  WHERE j.closed = false
  GROUP BY lg.id, jkg.tech
 HAVING count(DISTINCT j.id) > 0;

CREATE UNIQUE INDEX ux_mv_location_tech_location_tech
  ON public.mv_location_tech USING btree (location, tech);

CREATE INDEX ix_mv_location_tech_tech
  ON public.mv_location_tech USING btree (tech);

CREATE OR REPLACE FUNCTION public.refresh_mv_location_tech()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_location_tech;
END;
$function$;
