import { SupabaseTable } from '@codeshore/data-types';

export type ExistingJob = Pick<
  SupabaseTable.Job,
  'id' | 'updated_at' | 'created_at'
>;

export type RequireToCrawlJob = {
  id: string;
  title: string;
  url: string;
  existingJob: ExistingJob | undefined;
  needToCreate: boolean;
};
