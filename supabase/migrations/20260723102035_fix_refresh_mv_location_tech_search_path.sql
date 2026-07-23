-- location-map (task 1.1 follow-up): the initial refresh_mv_location_tech()
-- definition omitted SECURITY DEFINER / SET search_path, unlike its sibling
-- refresh_mv_company_tech() -- this caused a "Function Search Path Mutable"
-- security advisory that refresh_mv_company_tech does not have. Align with
-- the established refresh_mv_*_tech convention.
CREATE OR REPLACE FUNCTION public.refresh_mv_location_tech()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_location_tech;
END;
$function$;
