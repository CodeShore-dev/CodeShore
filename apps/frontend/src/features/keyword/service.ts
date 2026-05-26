import {
  ListResponse,
  SupabaseView,
} from '@codeshore/data-types';

import { ListQuery } from '../../@types';
import { httpClient } from '../../httpClient';

export const fetchKeywordGroupCategories = async (
  query?: ListQuery,
) => {
  const { data } = await httpClient.get<
    ListResponse<SupabaseView.KeywordGroupCategory>
  >('/api/keyword/group/category', { params: query });
  return data;
};

export const fetchMvKeywordGroup = async (
  query?: ListQuery,
) => {
  const { data } = await httpClient.get<
    ListResponse<SupabaseView.KeywordGroupView>
  >('/api/keyword/group', {
    params: {
      ...query,
      orders: 'count:desc;keyword_group',
    },
  });
  return data;
};

export const createKeywordGroup = async (
  id: string,
  keywords: string[] = [],
  category: string | null = null,
  parent: string | null = null,
): Promise<void> => {
  await httpClient.post('/api/keyword/group', {
    id,
    keywords,
    category,
    parent,
  });
};

export const updateKeywordGroup = async (
  id: string,
  payload: {
    keywords?: string[];
    category?: string | null;
    parent?: string | null;
  },
): Promise<void> => {
  await httpClient.patch(
    `/api/keyword/group/${encodeURIComponent(id)}`,
    payload,
  );
};

export const deleteKeywordGroup = async (
  id: string,
): Promise<void> => {
  await httpClient.delete(
    `/api/keyword/group/${encodeURIComponent(id)}`,
  );
};

export const deleteKeyword = async (
  id: string,
): Promise<void> => {
  await httpClient.delete(
    `/api/keyword/${encodeURIComponent(id)}`,
  );
};

export const resetMvKeywordGroup = async () => {
  await httpClient.post(`/api/keyword/group/reset`);
};
