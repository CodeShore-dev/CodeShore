-- Depends on mv_job
CREATE OR REPLACE FUNCTION public.get_jobs_by_preference(
  p_user_id uuid,
  p_preference text
)
RETURNS SETOF mv_job
LANGUAGE sql
STABLE
AS $function$
  SELECT j.*
  FROM mv_job j
  WHERE EXISTS (
    SELECT 1 FROM job_preference jp
    WHERE jp.job_id = j.id
      AND jp.user_id = p_user_id
      AND jp.preference = p_preference
  );
$function$;
