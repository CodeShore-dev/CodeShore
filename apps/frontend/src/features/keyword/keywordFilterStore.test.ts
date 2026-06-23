import { beforeEach, describe, expect, it } from 'vitest';

import { useKeywordFilterStore } from './keywordFilterStore';

beforeEach(() => {
  useKeywordFilterStore.getState().reset();
});

describe('keywordFilterStore.toggleLanguage', () => {
  it('cycles a tag through include -> exclude -> off', () => {
    const { toggleLanguage } = useKeywordFilterStore.getState();

    toggleLanguage('js');
    expect(useKeywordFilterStore.getState().selectedTags).toEqual(['js']);
    expect(useKeywordFilterStore.getState().excludedTags).toEqual([]);

    toggleLanguage('js');
    expect(useKeywordFilterStore.getState().selectedTags).toEqual([]);
    expect(useKeywordFilterStore.getState().excludedTags).toEqual(['js']);

    toggleLanguage('js');
    expect(useKeywordFilterStore.getState().selectedTags).toEqual([]);
    expect(useKeywordFilterStore.getState().excludedTags).toEqual([]);
  });
});
