import { httpClient } from '../../httpClient';

/**
 * 取得各資料庫物件的來源 SQL（物件名稱 -> CREATE 定義），
 * 由後端於建置時自 supabase/schema.sql 擷取。
 */
export const fetchMethodologySql = async () => {
  const res = await httpClient.get<Record<string, string>>(
    '/api/methodology/sql',
  );
  return res.data;
};
