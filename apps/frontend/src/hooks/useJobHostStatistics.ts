import { useQuery } from '@tanstack/react-query';

import { fetchJobHostStatistics } from '../features/home/service';

export interface HostShare {
  /** 正規化後的來源網域（去除 www. 前綴），如 104.com.tw、cake.me。 */
  readonly host: string;
  /** 該來源的職缺數。 */
  readonly count: number;
  /** 該來源佔全站職缺的百分比（0–100，四捨五入為整數，供顯示用）。 */
  readonly percent: number;
}

const normalizeHost = (host: string): string =>
  host.replace(/^www\./i, '').toLowerCase();

/**
 * 取得各來源網域的職缺佔比（get_job_host_statistics）。
 *
 * 後端回傳 host／host_count／percentage（百分比 0–100），此 hook 將其正規化為
 * 以網域為鍵的對照表，並提供 percentFor() 依網域查詢整數百分比，
 * 供首頁與方法論頁將「真實佔比」直接呈現於畫面，取代過往寫死的假數據。
 */
export function useJobHostStatistics() {
  const query = useQuery({
    queryKey: ['jobHostStatistics'],
    queryFn: fetchJobHostStatistics,
    staleTime: 5 * 60 * 1000,
  });

  const byHost: Record<string, HostShare> = {};
  for (const row of query.data ?? []) {
    const host = normalizeHost(row.host);
    byHost[host] = {
      host,
      count: Number(row.host_count),
      percent: Math.round(Number(row.percentage)),
    };
  }

  /** 依網域（接受帶或不帶 www. 的形式）取得整數百分比；無資料時回傳 undefined。 */
  const percentFor = (host: string): number | undefined =>
    byHost[normalizeHost(host)]?.percent;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    byHost,
    percentFor,
  };
}
