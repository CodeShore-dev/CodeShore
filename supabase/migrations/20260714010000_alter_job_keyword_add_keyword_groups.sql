-- Alters `job_keyword` to add `keyword_groups jsonb`, which stores job-level
-- grouped keyword requirements (KeywordGroup[]) categorised by technology class.
--
-- Requirement 4.2: 職缺關鍵字批次萃取流程將 job 層級的群組化關鍵字需求寫入資料儲存，
-- 使後續流程可以群組為單位存取該職缺的關鍵字語意。
--
-- The existing `keywords text[]` column is retained and continues to be written
-- for backwards compatibility with existing downstream consumers.
--
-- Source of truth for this DDL:
-- .kiro/specs/job-keyword-grouped-extraction/design.md
--   -> "資料模型" -> "`job_keyword`（schema 變更）"
-- .kiro/specs/job-keyword-grouped-extraction/requirements.md
--   -> Requirement 4（4.2）

ALTER TABLE public."job_keyword"
  ADD COLUMN "keyword_groups" jsonb NOT NULL DEFAULT '[]';
