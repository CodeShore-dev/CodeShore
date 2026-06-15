import {
  ListQuery,
  SupabaseFunction,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchListRPC } from '../shared-services/supabase/utils';

export type LocationAnomalyType =
  | 'blank'
  | 'unmapped'
  | 'malformed';

/**
 * Live list of jobs whose `location` is anomalous. Backed by the
 * `get_location_anomaly_jobs` SQL function (length / anti-join cannot be
 * expressed through the PostgREST where API). Paginated via fetchListRPC.
 */
export function fetchLocationAnomalyJobs(
  type: LocationAnomalyType,
  maxLen: number,
  query: ListQuery,
  logger?: ServiceLogger,
) {
  const functionName = 'get_location_anomaly_jobs';
  const builder = getSupabaseClient().rpc(
    functionName,
    { p_type: type, p_maxlen: maxLen },
    { count: 'exact' },
  );
  return fetchListRPC<SupabaseFunction.LocationAnomalyJob>(
    builder as any,
    query,
    { logger, name: functionName },
  );
}
