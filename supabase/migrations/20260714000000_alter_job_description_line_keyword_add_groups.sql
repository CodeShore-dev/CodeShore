-- Alters `job_description_line_keyword` to replace flat `final_keywords text[]`
-- with `final_keyword_groups jsonb`, which stores grouped AI-reviewed results
-- (KeywordGroup[]) categorised by technology class.
--
-- Requirement 3.1: 儲存每行 AI 覆核的群組化輸出、AI 是否調整，以及覆核狀態。
-- Requirement 3.2: 以可依「技術分類 + 關鍵字名稱」查詢的格式儲存群組化結果。
--
-- Source of truth for this DDL:
-- .kiro/specs/job-keyword-grouped-extraction/design.md
--   -> "資料模型" -> "`job_description_line_keyword`"
-- .kiro/specs/job-keyword-grouped-extraction/requirements.md
--   -> Requirement 3（3.1, 3.2）

ALTER TABLE public."job_description_line_keyword"
  DROP COLUMN IF EXISTS "final_keywords";

ALTER TABLE public."job_description_line_keyword"
  ADD COLUMN "final_keyword_groups" jsonb NOT NULL DEFAULT '[]';
