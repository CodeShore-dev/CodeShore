import { DEFAULT_PREFERENCE_REASON } from '@codeshore/shared-utils';

/**
 * `JobPreferenceService` builds its table from `getSupabaseClient()` in the
 * constructor, so the Supabase client is mocked at the module boundary and
 * each test asserts the exact PostgREST chain issued by `resetReason`.
 */
const mocks = vi.hoisted(() => {
  const result: { value: { error: unknown; count: number | null } } = {
    value: { error: null, count: 0 },
  };
  const builder: any = {};
  builder.update = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result.value).then(resolve, reject);
  const client = { from: vi.fn(() => builder) };
  return { result, builder, client };
});

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => mocks.client,
}));

import { JobPreferenceService } from './job_preference.service';

describe('JobPreferenceService.resetReason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.result.value = { error: null, count: 0 };
  });

  it('updates only reason to the default, scoped by user, preference and reason', async () => {
    mocks.result.value = { error: null, count: 3 };
    const service = new JobPreferenceService();

    const out = await service.resetReason('user-1', 'like', '想投');

    expect(mocks.client.from).toHaveBeenCalledWith('job_preference');
    expect(mocks.builder.update).toHaveBeenCalledTimes(1);
    expect(mocks.builder.update).toHaveBeenCalledWith(
      { reason: DEFAULT_PREFERENCE_REASON },
      { count: 'exact' },
    );
    // 5.4: preference and updated_at must not be part of the update payload.
    const payload = (mocks.builder.update.mock.calls[0] as unknown[])[0];
    expect(Object.keys(payload as object)).toEqual(['reason']);
    expect(mocks.builder.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['preference', 'like'],
      ['reason', '想投'],
    ]);
    expect(out).toEqual({ updated: 3 });
  });

  it('returns updated: 0 when count is null', async () => {
    mocks.result.value = { error: null, count: null };
    const service = new JobPreferenceService();

    await expect(
      service.resetReason('user-1', 'dislike', '太遠'),
    ).resolves.toEqual({ updated: 0 });
    expect(mocks.builder.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['preference', 'dislike'],
      ['reason', '太遠'],
    ]);
  });

  it('throws when the update fails', async () => {
    mocks.result.value = {
      error: { message: 'boom' },
      count: null,
    };
    const service = new JobPreferenceService();

    await expect(
      service.resetReason('user-1', 'like', '想投'),
    ).rejects.toThrow('boom');
  });
});

describe('JobPreferenceService.renameReason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.result.value = { error: null, count: 0 };
  });

  it('updates only reason to the new name, scoped by user, preference and the old reason', async () => {
    mocks.result.value = { error: null, count: 2 };
    const service = new JobPreferenceService();

    const out = await service.renameReason('user-1', 'like', '想投', '很想投');

    expect(mocks.client.from).toHaveBeenCalledWith('job_preference');
    expect(mocks.builder.update).toHaveBeenCalledTimes(1);
    expect(mocks.builder.update).toHaveBeenCalledWith(
      { reason: '很想投' },
      { count: 'exact' },
    );
    // 9.3: preference and updated_at must not be part of the update payload.
    const payload = (mocks.builder.update.mock.calls[0] as unknown[])[0];
    expect(Object.keys(payload as object)).toEqual(['reason']);
    expect(mocks.builder.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['preference', 'like'],
      ['reason', '想投'],
    ]);
    expect(out).toEqual({ updated: 2 });
  });

  it('returns updated: 0 when count is null', async () => {
    mocks.result.value = { error: null, count: null };
    const service = new JobPreferenceService();

    await expect(
      service.renameReason('user-1', 'dislike', '太遠', '真的太遠'),
    ).resolves.toEqual({ updated: 0 });
    expect(mocks.builder.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['preference', 'dislike'],
      ['reason', '太遠'],
    ]);
  });

  it('throws when the update fails', async () => {
    mocks.result.value = {
      error: { message: 'boom' },
      count: null,
    };
    const service = new JobPreferenceService();

    await expect(
      service.renameReason('user-1', 'like', '想投', '很想投'),
    ).rejects.toThrow('boom');
  });
});

describe('JobPreferenceService.reasonExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.result.value = { error: null, count: 0 };
  });

  it('returns true when at least one record matches, using an exact head-only count', async () => {
    mocks.result.value = { error: null, count: 1 };
    const service = new JobPreferenceService();

    const out = await service.reasonExists('user-1', 'like', '很想投');

    expect(mocks.client.from).toHaveBeenCalledWith('job_preference');
    expect(mocks.builder.select).toHaveBeenCalledTimes(1);
    expect(mocks.builder.select).toHaveBeenCalledWith('*', {
      count: 'exact',
      head: true,
    });
    expect(mocks.builder.eq.mock.calls).toEqual([
      ['user_id', 'user-1'],
      ['preference', 'like'],
      ['reason', '很想投'],
    ]);
    expect(out).toBe(true);
  });

  it('returns false when no record matches', async () => {
    mocks.result.value = { error: null, count: 0 };
    const service = new JobPreferenceService();

    await expect(
      service.reasonExists('user-1', 'dislike', '不存在的名稱'),
    ).resolves.toBe(false);
  });

  it('returns false when count is null', async () => {
    mocks.result.value = { error: null, count: null };
    const service = new JobPreferenceService();

    await expect(
      service.reasonExists('user-1', 'like', '想投'),
    ).resolves.toBe(false);
  });

  it('throws when the select fails', async () => {
    mocks.result.value = {
      error: { message: 'boom' },
      count: null,
    };
    const service = new JobPreferenceService();

    await expect(
      service.reasonExists('user-1', 'like', '想投'),
    ).rejects.toThrow('boom');
  });
});
