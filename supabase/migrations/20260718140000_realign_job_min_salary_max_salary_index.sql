-- job-timestamp-separation 遺留修復：ix_job_min_salary_max_salary_updated_at
--
-- 20260718000000 將 job.updated_at 改名為 job.crawled_at 時，這個既有索引的第三欄
-- 隨欄位改名自動同步指向 crawled_at，但索引名稱本身沒變，造成「名稱說是 updated_at，
-- 實際指向 crawled_at」的落差。索引原本刻意對齊 mv_job 定義中的
-- `ORDER BY min_salary DESC, max_salary DESC, updated_at DESC`，以便
-- REFRESH MATERIALIZED VIEW CONCURRENTLY 重建彙總結果時可利用索引順序、省去額外排序；
-- 但 mv_job 現在的 ORDER BY 用的是拆分後的新 updated_at（異動時間），必須讓這個索引
-- 的第三欄改回真正的 updated_at 欄位，才能恢復原本的效能設計初衷。

DROP INDEX IF EXISTS ix_job_min_salary_max_salary_updated_at;

CREATE INDEX ix_job_min_salary_max_salary_updated_at
  ON public.job USING btree (min_salary DESC, max_salary DESC, updated_at DESC);
