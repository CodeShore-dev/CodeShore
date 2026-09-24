const mocks = vi.hoisted(() => {
  const client = { rpc: vi.fn() };
  return { client };
});

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => mocks.client,
}));

import { getJobPreferenceReasonCounts } from './rpc';

describe('getJobPreferenceReasonCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls get_job_preference_reason_counts with user and preference and returns rows', async () => {
    const rows = [
      { reason: '未分類', job_count: 2 },
      { reason: '想投', job_count: 1 },
    ];
    mocks.client.rpc.mockResolvedValue({ data: rows, error: null });

    const out = await getJobPreferenceReasonCounts('user-1', 'like');

    expect(mocks.client.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.client.rpc).toHaveBeenCalledWith(
      'get_job_preference_reason_counts',
      { p_user_id: 'user-1', p_preference: 'like' },
    );
    expect(out).toEqual(rows);
  });

  it('returns an empty array when data is null', async () => {
    mocks.client.rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      getJobPreferenceReasonCounts('user-1', 'dislike'),
    ).resolves.toEqual([]);
    expect(mocks.client.rpc).toHaveBeenCalledWith(
      'get_job_preference_reason_counts',
      { p_user_id: 'user-1', p_preference: 'dislike' },
    );
  });

  it('throws when the rpc fails', async () => {
    mocks.client.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });

    await expect(
      getJobPreferenceReasonCounts('user-1', 'like'),
    ).rejects.toThrow('rpc failed');
  });
});
