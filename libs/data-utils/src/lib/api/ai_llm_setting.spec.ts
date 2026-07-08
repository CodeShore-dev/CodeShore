import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';

type Row = SupabaseTable.AiLlmSetting;

/**
 * Minimal fake in-memory PostgREST-style query builder for `ai_llm_setting`,
 * following the exact `select/filter/order/range` + `upsert` + `then` shape
 * established by `location_group.spec.ts` / `ai_suggestion.spec.ts` (the
 * inherited `TableService.fetchAll` -> `shared-services/supabase/utils.ts`'s
 * `_fetchList` drives the builder through `select().filter(column, 'eq',
 * value).order().range()`, then `await`s it directly).
 */
function createFakeBuilder(rows: Row[]) {
  let filtered = [...rows];
  let mode: 'select' | 'upsert' = 'select';
  let writePayload: Row[] | null = null;
  let upsertOptions: { onConflict?: string } | undefined;

  const builder: any = {
    url: new URL('https://example.test/ai_llm_setting'),
    select() {
      mode = 'select';
      filtered = [...rows];
      return builder;
    },
    filter(column: string, operator: string, value: unknown) {
      if (operator === 'eq') {
        filtered = filtered.filter(row => (row as any)[column] === value);
      }
      return builder;
    },
    order() {
      return builder;
    },
    range() {
      return builder;
    },
    upsert(records: Row[], options?: { onConflict?: string }) {
      mode = 'upsert';
      writePayload = records;
      upsertOptions = options;
      return builder;
    },
    then(resolve: (value: any) => void) {
      if (mode === 'upsert') {
        for (const record of writePayload as Row[]) {
          const conflictKey = upsertOptions?.onConflict ?? 'key';
          const idx = rows.findIndex(
            row => (row as any)[conflictKey] === (record as any)[conflictKey],
          );
          if (idx >= 0) rows[idx] = { ...rows[idx], ...record };
          else rows.push({ ...record });
        }
        mode = 'select';
        resolve({ data: writePayload, error: null, status: 201, count: null });
        return;
      }
      resolve({
        data: filtered,
        count: filtered.length,
        error: null,
        status: 200,
      });
    },
  };
  return builder;
}

function createFakeClient(rows: Row[]): SupabaseClient {
  const fakeBuilder = createFakeBuilder(rows);
  return {
    from() {
      return fakeBuilder;
    },
  } as unknown as SupabaseClient;
}

let fakeRows: Row[] = [];

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => createFakeClient(fakeRows),
}));

describe('AiLlmSettingService.getValue', () => {
  beforeEach(() => {
    fakeRows = [
      {
        key: 'default_model',
        value: 'meta-llama/llama-3.3-70b-instruct:free',
        updated_at: '2026-07-08T00:00:00.000Z',
      },
    ];
  });

  it('returns the value for a key that exists', async () => {
    const { AiLlmSettingService } = await import('./ai_llm_setting.service');
    const service = new AiLlmSettingService();

    const result = await service.getValue('default_model');

    expect(result).toBe('meta-llama/llama-3.3-70b-instruct:free');
  });

  it('returns null (without throwing) for a key that does not exist', async () => {
    const { AiLlmSettingService } = await import('./ai_llm_setting.service');
    const service = new AiLlmSettingService();

    const result = await service.getValue('does-not-exist');

    expect(result).toBeNull();
  });
});

describe('AiLlmSettingService.setValue', () => {
  beforeEach(() => {
    fakeRows = [
      {
        key: 'default_model',
        value: 'meta-llama/llama-3.3-70b-instruct:free',
        updated_at: '2026-07-08T00:00:00.000Z',
      },
    ];
  });

  it('inserts a new key that does not exist yet', async () => {
    const { AiLlmSettingService } = await import('./ai_llm_setting.service');
    const service = new AiLlmSettingService();

    await service.setValue('another_setting', 'some-value');

    const result = await service.getValue('another_setting');
    expect(result).toBe('some-value');
  });

  it('upserts (overwrites) the value for a key that already exists, rather than duplicating the row', async () => {
    const { AiLlmSettingService } = await import('./ai_llm_setting.service');
    const service = new AiLlmSettingService();

    await service.setValue(
      'default_model',
      'qwen/qwen-2.5-72b-instruct:free',
    );

    const result = await service.getValue('default_model');
    expect(result).toBe('qwen/qwen-2.5-72b-instruct:free');
    expect(fakeRows).toHaveLength(1);
  });
});
