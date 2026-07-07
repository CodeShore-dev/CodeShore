/**
 * Fakes the Supabase client's `.rpc(...)` call the same way
 * `libs/data-utils/src/lib/api/ai_suggestion.spec.ts` fakes the query
 * builder: no network call, just a stand-in returning the response shape
 * `detect_tech_parent_cycle` (supabase/migrations/20260707010000_create_detect_tech_parent_cycle.sql)
 * would produce.
 */
const rpcMock = vi.fn();

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: rpcMock,
  }),
}));

describe('detectTechParentCycle', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('reports no cycle when the RPC returns a null path', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const { detectTechParentCycle } = await import('./cycle-check');

    const result = await detectTechParentCycle('backend', 'nestjs');

    expect(result).toEqual({ hasCycle: false });
    expect(rpcMock).toHaveBeenCalledWith('detect_tech_parent_cycle', {
      p_parent: 'backend',
      p_child: 'nestjs',
    });
  });

  it('reports a cycle with the conflict path when the RPC returns a non-empty path', async () => {
    rpcMock.mockResolvedValue({
      data: ['nestjs', 'backend', 'nestjs'],
      error: null,
    });
    const { detectTechParentCycle } = await import('./cycle-check');

    const result = await detectTechParentCycle('nestjs', 'backend');

    expect(result).toEqual({
      hasCycle: true,
      conflictPath: ['nestjs', 'backend', 'nestjs'],
    });
  });

  it('surfaces an RPC error instead of silently returning hasCycle: false', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'function detect_tech_parent_cycle does not exist' },
    });
    const { detectTechParentCycle } = await import('./cycle-check');

    await expect(
      detectTechParentCycle('backend', 'nestjs'),
    ).rejects.toThrow(/detect_tech_parent_cycle/);
  });
});
