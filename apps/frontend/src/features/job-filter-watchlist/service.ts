import { AxiosError } from 'axios';

import type { JobFilterSnapshot } from '@codeshore/shared-utils';

import { httpClient } from '../../httpClient';

const BASE = '/api/job-filter-watchlist';

// Mirrors `apps/backend/src/features/job-filter-watchlist/service.ts`'s
// `SubscriptionWithCounts` field-for-field (camelCase over the wire -- no
// serializer/naming-strategy layer sits between that interface and the JSON
// response, confirmed by reading the backend service/controller directly).
export interface SubscriptionWithCounts {
  id: string;
  label: string;
  lastViewedAt: string;
  createdAt: string;
  totalCount: number;
  newCount: number;
}

// Body shape of the unwrapped 409 response the backend controller sends for
// `POST /api/job-filter-watchlist` when the user is at their subscription
// cap (design.md "job-filter-watchlist Controller" table).
export interface WatchlistLimitReachedBody {
  code: 'WATCHLIST_LIMIT_REACHED';
  limit: number;
}

// Follows the currently applied filter combination (design.md 1.1-1.3, 5.1-5.3).
// Success (201 created / 200 already_exists) both resolve with the
// `SubscriptionWithCounts` -- `httpClient`'s shared `transformResponse`
// interceptor already unwraps `response.data.data` for any 2xx response, so
// `res.data` here is already the plain subscription, not the envelope.
//
// This repo's established convention (see
// `httpClient/interceptors/onResponse/errorHandleResponse.ts`'s
// `error instanceof AxiosError` check, and every other `features/*/service.ts`
// in this codebase) is "let axios throw on non-2xx, callers catch" -- there is
// no typed-error-result wrapper convention anywhere in this codebase to reuse
// instead. So the 409 case is deliberately NOT caught here: it propagates as a
// rejected promise carrying the raw (untransformed, since axios only runs the
// response interceptor's fulfilled branch on 2xx) `{ code, limit }` body on
// `error.response.data`. `isWatchlistLimitReachedError` below is the typed
// guard the mutation layer (task 4.1's follow button) uses to distinguish it
// from a network/server error, without inventing a new flow-control shape.
export const followFilter = async (
  filterSnapshot: JobFilterSnapshot,
  filterWhere: Record<string, unknown>,
  label: string,
): Promise<SubscriptionWithCounts> => {
  const res = await httpClient.post<SubscriptionWithCounts>(BASE, {
    filterSnapshot,
    filterWhere,
    label,
  });
  return res.data;
};

// Typed guard distinguishing the 409 WATCHLIST_LIMIT_REACHED rejection
// `followFilter` lets propagate from any other error `httpClient` might
// reject with (network failure, 401, 500, ...).
export function isWatchlistLimitReachedError(
  error: unknown,
): error is AxiosError<WatchlistLimitReachedBody> {
  if (!(error instanceof AxiosError)) return false;
  if (error.response?.status !== 409) return false;
  return (
    (error.response.data as Partial<WatchlistLimitReachedBody> | undefined)
      ?.code === 'WATCHLIST_LIMIT_REACHED'
  );
}

// Fetches the current user's followed filter combinations, each already
// enriched with totalCount/newCount/lastViewedAt (design.md 2.1-2.3, 3.1).
export const fetchWatchlist = async (): Promise<
  SubscriptionWithCounts[]
> => {
  const res = await httpClient.get<SubscriptionWithCounts[]>(BASE);
  return res.data;
};

// Marks a followed filter combination as just viewed (design.md 3.2),
// returning the refreshed subscription. 404 (not found / not owned)
// propagates as a rejected promise, same convention as `followFilter`.
export const markWatchlistViewed = async (
  id: string,
): Promise<SubscriptionWithCounts> => {
  const res = await httpClient.patch<SubscriptionWithCounts>(
    `${BASE}/${encodeURIComponent(id)}/viewed`,
  );
  return res.data;
};

// Unfollows a filter combination (design.md 4.1). 404 (not found / not
// owned) propagates as a rejected promise, same convention as `followFilter`.
export const unfollowFilter = async (id: string): Promise<void> => {
  await httpClient.delete(`${BASE}/${encodeURIComponent(id)}`);
};
