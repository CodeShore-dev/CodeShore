-- Adds `keyword_groups jsonb` to mv_job by rebuilding the materialized view.
--
-- `get_unreviewed_jobs` returns SETOF mv_job and must be dropped first (it
-- depends on the view's composite type), then recreated after.
-- `get_jobs_by_preference` uses an explicit RETURNS TABLE, but Postgres
-- still rejects `CREATE OR REPLACE FUNCTION` when the OUT-parameter row
-- shape changes (adding `keyword_groups` here does) -- confirmed against
-- the live project via `apply_migration`, which failed with:
--   42P13: cannot change return type of existing function
--   DETAIL: Row type defined by OUT parameters is different.
--   HINT: Use DROP FUNCTION get_jobs_by_preference(uuid,text) first.
-- So it must be dropped first too, same as get_unreviewed_jobs.

DROP FUNCTION IF EXISTS public.get_unreviewed_jobs(uuid);
DROP FUNCTION IF EXISTS public.get_jobs_by_preference(uuid, text);
DROP MATERIALIZED VIEW IF EXISTS public.mv_job;

CREATE MATERIALIZED VIEW public."mv_job" AS
 SELECT j.id,
    j.title,
    COALESCE(lg.id, j.location) AS location,
    j.detail_link,
    j.salary,
    j.salary_type,
    j.min_salary,
    j.max_salary,
        CASE
            WHEN j.min_salary > 0 AND j.max_salary < 9999999 THEN round((j.min_salary + j.max_salary)::numeric / 2.0, 0)
            WHEN j.min_salary > 0 AND j.max_salary = 9999999 THEN round(j.min_salary::numeric * (1.0 + mv.ratio) / 2.0, 0)
            ELSE NULL::numeric
        END AS avg_salary,
    j.created_at,
    j.updated_at,
    j.description,
    c.id AS company_id,
    c.name AS company_name,
    c.link AS company_link,
    c.type AS company_type,
    array_agg(jkg.tech) FILTER (WHERE jkg.tech IS NOT NULL) AS techs,
    array_agg((jkg.tech || ':'::text) || jkg.keywords) FILTER (WHERE jkg.tech IS NOT NULL) AS tech_mappings,
    j.closed,
    jk.description_ch_en_ratio,
    jk.keyword_groups
   FROM job j
     JOIN job_keyword jk ON jk.id = j.id
     JOIN company c ON j.company_id = c.id
     LEFT JOIN job_tech jkg ON jkg.job_id = j.id
     LEFT JOIN location_group_location lgl ON j.location = lgl.location
     LEFT JOIN location_group lg ON lgl.location_group = lg.id
     LEFT JOIN mv_salary_range_multiplier mv ON j.salary_type = mv.salary_type
  WHERE j.closed = false
  GROUP BY j.id, j.title, (COALESCE(lg.id, j.location)), j.detail_link, j.salary, j.salary_type, j.min_salary, j.max_salary, j.created_at, j.updated_at, j.description, c.id, c.name, c.link, c.type, jk.description_ch_en_ratio, j.closed, mv.ratio, jk.keyword_groups
  ORDER BY j.min_salary DESC, j.max_salary DESC, j.updated_at DESC;

CREATE UNIQUE INDEX mv_job_id_idx ON public.mv_job USING btree (id);
CREATE INDEX ix_mv_job_company_id ON public.mv_job USING btree (company_id);
CREATE INDEX ix_mv_job_max_salary ON public.mv_job USING btree (max_salary DESC);
CREATE INDEX ix_mv_job_min_salary ON public.mv_job USING btree (min_salary DESC);
CREATE INDEX ix_mv_job_salary_type ON public.mv_job USING btree (salary_type);
CREATE INDEX ix_mv_job_techs ON public.mv_job USING gin (techs);
CREATE INDEX ix_mv_job_updated_at ON public.mv_job USING btree (updated_at DESC);
CREATE INDEX mv_job_location_idx ON public.mv_job USING btree (location);

CREATE OR REPLACE FUNCTION public.get_unreviewed_jobs(p_user_id uuid)
 RETURNS SETOF mv_job
 LANGUAGE sql
 STABLE
AS $function$
   SELECT j.*
   FROM mv_job j
   WHERE NOT EXISTS (
     SELECT 1 FROM job_preference jp
     WHERE jp.job_id = j.id
       AND jp.user_id = p_user_id
   );
 $function$;

CREATE OR REPLACE FUNCTION public.get_jobs_by_preference(p_user_id uuid, p_preference text)
 RETURNS TABLE(id text, title text, location text, detail_link text, salary text, salary_type text, min_salary integer, max_salary integer, avg_salary numeric, created_at timestamp with time zone, updated_at timestamp with time zone, description text, company_id text, company_name text, company_link text, company_type text, techs text[], tech_mappings text[], closed boolean, description_ch_en_ratio numeric, keyword_groups jsonb, preference_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT j.*, jp.updated_at AS preference_updated_at
  FROM mv_job j
  JOIN job_preference jp
    ON jp.job_id = j.id
   AND jp.user_id = p_user_id
   AND jp.preference = p_preference;
$function$;
