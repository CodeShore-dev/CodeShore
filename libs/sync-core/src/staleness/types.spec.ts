import { describe, expect, it } from 'vitest';

import type { StalenessSyncConfig } from './types';

// This spec's real job is to force `tsc` (via `nx build sync-core`) to
// type-check a genuine, fully-typed usage of `StalenessSyncConfig`.
// Runtime assertions here only confirm the object literal behaves as expected;
// the actual correctness proof is that this file compiles with zero `any`
// and zero type errors, and that all three `diffAndBuildUpdate` result
// variants carry `entity`.

interface TestEntity {
  id: string;
  value: string;
}

interface TestDetail {
  content: string;
}

describe('staleness/types', () => {
  it('StalenessSyncConfig accepts a fully-typed object literal with every required field', () => {
    const config: StalenessSyncConfig<TestEntity, TestDetail> = {
      fetchStaleEntities: async () => [{ id: 'entity-1', value: 'stale' }],
      resolveDetailUrl: entity => `https://example.test/detail/${entity.id}`,
      resolveHost: url => new URL(url).host,
      waitSelectorForHost: host => `.detail-root-${host}`,
      extractDetailForHost: () => async () => ({ content: 'stub' }),
      diffAndBuildUpdate: (entity, detail) => {
        if (detail === undefined) {
          return { action: 'close', entity };
        }
        if (detail.content === entity.value) {
          return { action: 'unchanged', entity };
        }
        return {
          action: 'update',
          entity: { ...entity, value: detail.content },
        };
      },
      batchSize: 5,
      onBatchReady: async () => {
        /* no-op for type-usage smoke test */
      },
      logger: {
        info: () => undefined,
        warning: () => undefined,
        error: () => undefined,
      },
    };

    expect(config.resolveDetailUrl({ id: 'entity-1', value: 'stale' })).toBe(
      'https://example.test/detail/entity-1',
    );
    expect(config.resolveHost('https://example.test/detail/entity-1')).toBe(
      'example.test',
    );
    expect(config.batchSize).toBe(5);
  });

  it("diffAndBuildUpdate's 'unchanged' variant carries entity", () => {
    const entity: TestEntity = { id: 'entity-2', value: 'same' };
    const diffAndBuildUpdate: StalenessSyncConfig<
      TestEntity,
      TestDetail
    >['diffAndBuildUpdate'] = (e, detail) => {
      if (detail && detail.content === e.value) {
        return { action: 'unchanged', entity: e };
      }
      return { action: 'update', entity: e };
    };

    const result = diffAndBuildUpdate(entity, { content: 'same' });

    expect(result.action).toBe('unchanged');
    expect(result.entity).toEqual(entity);
  });

  it("diffAndBuildUpdate's 'update' variant carries entity", () => {
    const entity: TestEntity = { id: 'entity-3', value: 'old' };
    const diffAndBuildUpdate: StalenessSyncConfig<
      TestEntity,
      TestDetail
    >['diffAndBuildUpdate'] = (e, detail) => ({
      action: 'update',
      entity: { ...e, value: detail?.content ?? e.value },
    });

    const result = diffAndBuildUpdate(entity, { content: 'new' });

    expect(result.action).toBe('update');
    expect(result.entity).toEqual({ id: 'entity-3', value: 'new' });
  });

  it("diffAndBuildUpdate's 'close' variant carries entity", () => {
    const entity: TestEntity = { id: 'entity-4', value: 'whatever' };
    const diffAndBuildUpdate: StalenessSyncConfig<
      TestEntity,
      TestDetail
    >['diffAndBuildUpdate'] = (e, detail) => {
      if (detail === undefined) {
        return { action: 'close', entity: e };
      }
      return { action: 'unchanged', entity: e };
    };

    const result = diffAndBuildUpdate(entity, undefined);

    expect(result.action).toBe('close');
    expect(result.entity).toEqual(entity);
  });

  it('StalenessSyncConfig is usable without the optional batchSize and logger fields', () => {
    const config: StalenessSyncConfig<TestEntity, TestDetail> = {
      fetchStaleEntities: async () => [],
      resolveDetailUrl: entity => entity.id,
      resolveHost: () => 'default-host',
      waitSelectorForHost: () => '.detail-root',
      extractDetailForHost: () => () => undefined,
      diffAndBuildUpdate: entity => ({ action: 'close', entity }),
      onBatchReady: async () => {
        /* no-op for type-usage smoke test */
      },
    };

    expect(config.batchSize).toBeUndefined();
    expect(config.logger).toBeUndefined();
  });
});
