import { beforeEach, describe, expect, it } from 'vitest';

import { useKeywordFilterStore } from '../keyword/keywordFilterStore';
import { useCompanyTechFilterStore } from './companyTechFilterStore';

beforeEach(() => {
  useCompanyTechFilterStore.getState().reset();
  useKeywordFilterStore.getState().reset();
});

describe('useCompanyTechFilterStore', () => {
  it('is a distinct instance from the job page store (identity check)', () => {
    expect(useCompanyTechFilterStore).not.toBe(useKeywordFilterStore);
  });

  it('selecting a technology in the company store does not affect the job page store', () => {
    useCompanyTechFilterStore.getState().toggleLanguage('go');

    expect(useCompanyTechFilterStore.getState().selectedTags).toEqual(['go']);
    expect(useKeywordFilterStore.getState().selectedTags).toEqual([]);
    expect(useKeywordFilterStore.getState().excludedTags).toEqual([]);
  });

  it('selecting a technology in the job page store does not affect the company store', () => {
    useKeywordFilterStore.getState().toggleLanguage('python');

    expect(useKeywordFilterStore.getState().selectedTags).toEqual(['python']);
    expect(useCompanyTechFilterStore.getState().selectedTags).toEqual([]);
    expect(useCompanyTechFilterStore.getState().excludedTags).toEqual([]);
  });
});
