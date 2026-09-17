import { promises as fs } from 'fs';

/**
 * 解析單欄 job id CSV 內容:每列僅取第一欄(逗號前的部分),可選雙引號包覆;
 * 忽略空白列;若第一筆非空列的內容恰為 "id"(忽略大小寫),視為表頭而跳過。
 * 回傳去重後的 job id 清單,維持原始出現順序。
 */
export function parseJobIdCsv(content: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let sawFirstDataLine = false;

  for (const rawLine of content.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const firstField = line
      .split(',')[0]
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .trim();
    if (!firstField) continue;

    if (!sawFirstDataLine) {
      sawFirstDataLine = true;
      if (firstField.toLowerCase() === 'id' || firstField.toLowerCase() === 'job_id') continue;
    }

    if (!seen.has(firstField)) {
      seen.add(firstField);
      ids.push(firstField);
    }
  }

  return ids;
}

/** 讀取並解析 job id CSV 檔案,檔案不存在或不含任何 id 時皆拋出描述性錯誤。 */
export async function readJobIdsFromCsvFile(
  filePath: string,
): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ids = parseJobIdCsv(content);

  if (ids.length === 0) {
    throw new Error(
      `Job id CSV file contains no job ids: ${filePath}`,
    );
  }

  return ids;
}

/**
 * 依 job id 清單建立 PostgREST `in` 篩選子句,對應
 * `main.ts` `parseWhereExpr` 對 `id.in.(1,2,3)` 的解析結果格式
 * (`{ id: { in: '(1,2,3)' } }`),確保與既有 `re-crawl=<whereExpr>`
 * 走同一條 `JobService().fetchAll({ where })` 路徑。
 */
export function buildJobIdWhere(
  jobIds: string[],
): Record<string, unknown> {
  return { id: { in: `(${jobIds.join(',')})` } };
}
