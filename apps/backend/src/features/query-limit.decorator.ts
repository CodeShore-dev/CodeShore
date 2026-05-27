import { SetMetadata } from '@nestjs/common';

export const QUERY_LIMIT_KEY = 'queryLimit';
export const DEFAULT_QUERY_LIMIT = 50;

export const LimitQuery = (maxTo: number = DEFAULT_QUERY_LIMIT) =>
  SetMetadata(QUERY_LIMIT_KEY, maxTo);
