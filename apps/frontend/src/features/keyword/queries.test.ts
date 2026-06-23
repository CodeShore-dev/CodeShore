import { describe, expect, it } from 'vitest';

import type { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP } from '../../utils/constants';
import { buildKeywordAdminWhere, deriveTabs } from './queries';

const knownKey = Object.keys(CATEGORY_LABEL_MAP)[0];

describe('deriveTabs', () => {
  it('builds a labelled tab for a known category', () => {
    const tabs = deriveTabs([
      { category: knownKey, count: 5 },
    ] as unknown as SupabaseView.MvTechCategory[]);

    const tab = tabs.find(t => t.value === knownKey);
    expect(tab?.label).toBe(CATEGORY_LABEL_MAP[knownKey]);
    expect(tab?.count).toBe(5);
  });

  it('aggregates unknown categories into a trailing 其他 bucket', () => {
    const tabs = deriveTabs([
      { category: knownKey, count: 5 },
      { category: '__unknown_a__', count: 3 },
      { category: '__unknown_b__', count: 4 },
    ] as unknown as SupabaseView.MvTechCategory[]);

    const last = tabs[tabs.length - 1];
    expect(last.value).toBe('');
    expect(last.label).toBe('其他');
    expect(last.count).toBe(7);
  });
});

describe('buildKeywordAdminWhere', () => {
  it('returns undefined for the all filter with no search', () => {
    expect(buildKeywordAdminWhere('all', '')).toBeUndefined();
  });

  it('emits the grouped base condition', () => {
    expect(buildKeywordAdminWhere('grouped', '')).toBe(
      JSON.stringify({ $or: 'category.not.is.null' }),
    );
  });

  it('emits the ungrouped base condition', () => {
    expect(buildKeywordAdminWhere('ungrouped', '')).toBe(
      JSON.stringify({ $or: 'category.is.null' }),
    );
  });

  it('adds a trimmed ilike search on tech', () => {
    expect(buildKeywordAdminWhere('all', '  react ')).toBe(
      JSON.stringify({ tech: { ilike: '%react%' } }),
    );
  });

  it('combines filter base and search', () => {
    expect(buildKeywordAdminWhere('grouped', 'vue')).toBe(
      JSON.stringify({
        $or: 'category.not.is.null',
        tech: { ilike: '%vue%' },
      }),
    );
  });
});
