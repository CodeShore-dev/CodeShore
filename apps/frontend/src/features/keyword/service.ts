import {
  ListResponse,
  SupabaseView,
} from '@codeshore/data-types';

import { ListQuery } from '../../@types';
import { httpClient } from '../../httpClient';

export const fetchTechCategories = async (
  query?: ListQuery,
) => {
  const { data } = await httpClient.get<
    ListResponse<SupabaseView.MvTechCategory>
  >('/api/keyword/group/category', { params: query });
  return data;
};

export const fetchMvTech = async (
  query?: ListQuery,
) => {
  const { data } = await httpClient.get<
    ListResponse<SupabaseView.MvTech>
  >('/api/keyword/group', {
    params: {
      ...query,
      orders: 'count:desc;tech',
    },
  });
  return data;
};

export const createTech = async (
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

export const updateTech = async (
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

export const updateTechIconSlugs = async (
  id: string,
  icon_slugs: string[],
): Promise<void> => {
  await httpClient.patch('/api/keyword/group/icon-slugs', {
    id,
    icon_slugs,
  });
};

export const deleteTech = async (
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

export const resetMvTech = async () => {
  await httpClient.post(`/api/keyword/group/reset`);
};
