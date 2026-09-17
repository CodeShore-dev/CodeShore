-- Switches `mv_salary_range_multiplier.ratio` from the arithmetic MEAN of
-- each job's `max_salary / min_salary` to the MEDIAN
-- (`percentile_cont(0.5)`).
--
-- Why: the per-job ratio is right-skewed. It has a hard floor at 1
-- (`max >= min`) and no ceiling, so a few wide-range jobs pull the mean up.
-- The year ratio was 1.665 (the value users saw as "too high") while the
-- median is 1.511; the mean sits near the ~58th percentile, not the typical
-- job. The ratio feeds the "面議／以上" estimate
-- `min * (1 + ratio) / 2` in mv_job, mv_location_salary and
-- mv_salary_type_median_ratio, so the mean over-estimates those salaries by
-- ~6% (year) / ~3% (month). The median is robust to the skew and needs no
-- arbitrary outlier cut-off.
--
-- Blast radius: mv_salary_range_multiplier is JOINed by three other
-- materialized views (mv_job, mv_location_salary,
-- mv_salary_type_median_ratio). Postgres has no
-- `CREATE OR REPLACE MATERIALIZED VIEW`, and those JOINs are hard catalog
-- dependencies, so the change forces a `DROP ... CASCADE` and a rebuild of
-- the whole chain. This cost is inherent to touching the shared view's
-- definition at all; it is not specific to the mean-to-median switch.
--
-- CASCADE also drops `get_unreviewed_jobs(uuid)` (it `RETURNS SETOF mv_job`,
-- a hard dependency on mv_job's rowtype) and every index on the rebuilt
-- views. `get_jobs_by_preference` and `get_job_preference_counts` reference
-- mv_job only in their bodies (no tracked dependency) and survive. The
-- `refresh_mv_*` functions reference the views by name inside plpgsql and
-- also survive.
--
-- Each rebuilt view is recreated WITH DATA (the default), so the chain is
-- repopulated in dependency order within this migration; no separate REFRESH
-- is required. The rebuilt definitions are byte-for-byte identical to the
-- current schema except for mv_salary_range_multiplier's aggregate.
--
-- Grants: the four views currently grant ALL to anon, authenticated and
-- service_role, and `get_unreviewed_jobs` grants EXECUTE to PUBLIC plus those
-- roles. DROP/CREATE resets ACLs, so every grant is restored below.

-- ── Drop the shared view and its dependent chain ──────────────────────────
DROP MATERIALIZED VIEW public."mv_salary_range_multiplier" CASCADE;

-- ── 1. Shared multiplier (MEAN -> MEDIAN) ─────────────────────────────────
CREATE MATERIALIZED VIEW public."mv_salary_range_multiplier" AS
 SELECT salary_type,
    round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY max_salary::numeric / min_salary::numeric)::numeric, 2) AS ratio
   FROM job
  WHERE min_salary > 0 AND max_salary < 9999999 AND max_salary >= min_salary AND (salary_type = ANY (ARRAY['month'::text, 'year'::text]))
  GROUP BY salary_type;

CREATE UNIQUE INDEX idx_mv_salary_range_multiplier_type ON public.mv_salary_range_multiplier USING btree (salary_type);

GRANT ALL ON public.mv_salary_range_multiplier TO anon, authenticated, service_role;

-- ── 2. mv_job (unchanged definition, rebuilt because it JOINs the view) ────
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
    jk.keyword_groups,
    j.crawled_at
   FROM job j
     JOIN job_keyword jk ON jk.id = j.id
     JOIN company c ON j.company_id = c.id
     LEFT JOIN job_tech jkg ON jkg.job_id = j.id
     LEFT JOIN location_group_location lgl ON j.location = lgl.location
     LEFT JOIN location_group lg ON lgl.location_group = lg.id
     LEFT JOIN mv_salary_range_multiplier mv ON j.salary_type = mv.salary_type
  WHERE j.closed = false
  GROUP BY j.id, j.title, (COALESCE(lg.id, j.location)), j.detail_link, j.salary, j.salary_type, j.min_salary, j.max_salary, j.created_at, j.updated_at, j.description, c.id, c.name, c.link, c.type, jk.description_ch_en_ratio, j.closed, mv.ratio, jk.keyword_groups, j.crawled_at
  ORDER BY j.min_salary DESC, j.max_salary DESC, j.updated_at DESC;

CREATE UNIQUE INDEX mv_job_id_idx ON public.mv_job USING btree (id);
CREATE INDEX ix_mv_job_company_id ON public.mv_job USING btree (company_id);
CREATE INDEX ix_mv_job_crawled_at ON public.mv_job USING btree (crawled_at DESC);
CREATE INDEX ix_mv_job_max_salary ON public.mv_job USING btree (max_salary DESC);
CREATE INDEX ix_mv_job_min_salary ON public.mv_job USING btree (min_salary DESC);
CREATE INDEX ix_mv_job_salary_type ON public.mv_job USING btree (salary_type);
CREATE INDEX ix_mv_job_techs ON public.mv_job USING gin (techs);
CREATE INDEX ix_mv_job_updated_at ON public.mv_job USING btree (updated_at DESC);
CREATE INDEX mv_job_location_idx ON public.mv_job USING btree (location);

GRANT ALL ON public.mv_job TO anon, authenticated, service_role;

-- ── 2a. get_unreviewed_jobs (RETURNS SETOF mv_job, dropped by CASCADE) ─────
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

GRANT EXECUTE ON FUNCTION public.get_unreviewed_jobs(uuid) TO anon, authenticated, service_role;

-- ── 3. mv_location_salary (unchanged definition) ──────────────────────────
CREATE MATERIALIZED VIEW public."mv_location_salary" AS
 SELECT lg.id AS location,
    j.salary_type,
    COALESCE(count(DISTINCT j.id), 0::bigint) AS job_count,
    avg(
        CASE
            WHEN j.min_salary > 0 AND j.max_salary < 9999999 THEN round((j.min_salary + j.max_salary)::numeric / 2.0, 0)
            WHEN j.min_salary > 0 AND j.max_salary = 9999999 THEN round(j.min_salary::numeric * (1.0 + mv.ratio) / 2.0, 0)
            ELSE NULL::numeric
        END) AS avg_salary
   FROM job j
     JOIN location_group_location lgl ON lgl.location = j.location
     JOIN location_group lg ON lg.id = lgl.location_group
     LEFT JOIN mv_salary_range_multiplier mv ON j.salary_type = mv.salary_type
  WHERE j.closed = false
  GROUP BY lg.id, j.salary_type
 HAVING count(DISTINCT j.id) > 0;

CREATE UNIQUE INDEX ux_mv_location_salary_location_type ON public.mv_location_salary USING btree (location, salary_type);

GRANT ALL ON public.mv_location_salary TO anon, authenticated, service_role;

-- ── 4. mv_salary_type_median_ratio (unchanged definition) ─────────────────
CREATE MATERIALIZED VIEW public."mv_salary_type_median_ratio" AS
 WITH job_salary AS (
         SELECT j.salary_type,
                CASE
                    WHEN j.min_salary > 0 AND j.max_salary < 9999999 AND j.max_salary >= j.min_salary THEN (j.min_salary + j.max_salary)::numeric / 2.0
                    WHEN j.min_salary > 0 AND j.max_salary = 9999999 THEN j.min_salary::numeric * (1.0 + mv.ratio) / 2.0
                    ELSE NULL::numeric
                END::double precision AS representative_salary
           FROM job j
             JOIN mv_salary_range_multiplier mv ON j.salary_type = mv.salary_type
          WHERE (j.salary_type = ANY (ARRAY['month'::text, 'year'::text])) AND j.closed = false
        )
 SELECT salary_type,
    round(percentile_cont(0.50::double precision) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS median_mark,
    round(percentile_cont(0.75::double precision) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS high_mark,
    round(percentile_cont(0.88::double precision) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS top_mark
   FROM job_salary
  WHERE representative_salary IS NOT NULL
  GROUP BY salary_type
  ORDER BY salary_type;

CREATE UNIQUE INDEX idx_mv_salary_type_median_ratio_type ON public.mv_salary_type_median_ratio USING btree (salary_type);

GRANT ALL ON public.mv_salary_type_median_ratio TO anon, authenticated, service_role;
