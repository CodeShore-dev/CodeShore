-- Alters `job_source` to add `enabled boolean`, a manual on/off switch for
-- whether a job source should be picked up by the crawler's `crawl` (fresh)
-- mode. Existing rows default to true so today's crawl behaviour is
-- unchanged until someone explicitly disables a source.

ALTER TABLE public."job_source"
  ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;
