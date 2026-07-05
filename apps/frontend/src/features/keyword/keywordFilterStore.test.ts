import { beforeEach, describe, expect, it } from 'vitest';

import { createTechFilterStore, useKeywordFilterStore } from './keywordFilterStore';

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

describe('createTechFilterStore', () => {
  it('creates independent store instances whose selections do not leak into each other', () => {
    const storeA = createTechFilterStore();
    const storeB = createTechFilterStore();

    storeA.getState().toggleLanguage('rust');

    expect(storeA.getState().selectedTags).toEqual(['rust']);
    expect(storeB.getState().selectedTags).toEqual([]);
    expect(storeB.getState().excludedTags).toEqual([]);
  });
});
