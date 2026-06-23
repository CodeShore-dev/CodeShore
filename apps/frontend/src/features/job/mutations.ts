import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { SupabaseView } from '@codeshore/data-types';

import { useJobFilterStore } from './jobFilterStore';
import { clearJobPreferences, setJobPreference } from './service';

export interface PreferenceCounts {
  liked_count: number;
  disliked_count: number;
}

type JobListData = { result: SupabaseView.MvJob[]; count: number };

// Pure count adjustment for an optimistic like/dislike (task 7.2,
// requirement 3.3), ported from useJobStore.updateListJobPreference:
// - from the default list (null tab): increment the chosen bucket
// - from a tab: move the count across when the preference flips
export function adjustCounts(
  currentTab: 'like' | 'dislike' | null,
  newPreference: 'like' | 'dislike',
  counts: PreferenceCounts,
): PreferenceCounts {
  let liked = counts.liked_count;
  let disliked = counts.disliked_count;
  if (currentTab === null) {
    if (newPreference === 'like') liked++;
    else disliked++;
  } else if (currentTab === 'like' && newPreference === 'dislike') {
    liked--;
    disliked++;
  } else if (currentTab === 'dislike' && newPreference === 'like') {
    disliked--;
    liked++;
  }
  return { liked_count: liked, disliked_count: disliked };
}

// Optimistic preference mutation: removes the job from every cached job list
// and adjusts the cached counts; rolls back on error; invalidates on settle.
export function usePreferenceMutation() {
  const queryClient = useQueryClient();
  const listViewPreference = useJobFilterStore(s => s.listViewPreference);

  return useMutation({
    mutationFn: ({
      id,
      preference,
    }: {
      id: string;
      preference: 'like' | 'dislike';
    }) => setJobPreference(id, preference),
    onMutate: async ({ id, preference }) => {
      await queryClient.cancelQueries({ queryKey: ['job'] });
      const prevLists = queryClient.getQueriesData<JobListData>({
        queryKey: ['job', 'list'],
      });
      const prevCount = queryClient.getQueryData<PreferenceCounts>([
        'job',
        'preferencedCount',
      ]);

      queryClient.setQueriesData<JobListData>(
        { queryKey: ['job', 'list'] },
        old =>
          old
            ? { ...old, result: old.result.filter(job => job.id !== id) }
            : old,
      );
      if (prevCount) {
        queryClient.setQueryData(
          ['job', 'preferencedCount'],
          adjustCounts(listViewPreference, preference, prevCount),
        );
      }

      return { prevLists, prevCount };
    },
    onError: (_error, _vars, context) => {
      context?.prevLists?.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
      if (context?.prevCount) {
        queryClient.setQueryData(
          ['job', 'preferencedCount'],
          context.prevCount,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['job', 'list'] });
      queryClient.invalidateQueries({
        queryKey: ['job', 'preferencedCount'],
      });
    },
  });
}

// Clears every like/dislike mark for a bucket, then refreshes the list and
// counts (task 7.5), ported from useJobStore.clearPreferences.
export function useClearPreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preference: 'like' | 'dislike') =>
      clearJobPreferences(preference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', 'list'] });
      queryClient.invalidateQueries({
        queryKey: ['job', 'preferencedCount'],
      });
    },
  });
}
