import { describe, expect, it } from 'vitest';

import type { AiSuggestionWorkflow } from '@codeshore/data-types';

import {
  AI_SUGGESTION_WORKFLOW_PURPOSE,
  KEYWORD_CURATION_INTRO,
  KEYWORD_CURATION_PATH_PURPOSE,
} from './aiWorkflows';

describe('aiWorkflows content', () => {
  describe('AI_SUGGESTION_WORKFLOW_PURPOSE', () => {
    const ALL_WORKFLOWS: readonly AiSuggestionWorkflow[] = [
      'keyword_mapping',
      'tech_dictionary',
      'tech_hierarchy',
      'location_mapping',
      'noise_detection',
    ];

    it('covers exactly the 5 known AiSuggestionWorkflow values', () => {
      const keys = Object.keys(AI_SUGGESTION_WORKFLOW_PURPOSE).sort();
      expect(keys).toEqual([...ALL_WORKFLOWS].sort());
    });

    it('has a non-empty purpose string for every workflow', () => {
      for (const workflow of ALL_WORKFLOWS) {
        const purpose = AI_SUGGESTION_WORKFLOW_PURPOSE[workflow];
        expect(typeof purpose).toBe('string');
        expect(purpose.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('KEYWORD_CURATION_PATH_PURPOSE', () => {
    const ALL_PATHS = ['A', 'B', 'C'] as const;

    it('covers exactly A/B/C', () => {
      const keys = Object.keys(KEYWORD_CURATION_PATH_PURPOSE).sort();
      expect(keys).toEqual([...ALL_PATHS].sort());
    });

    it('has a non-empty purpose string for every path', () => {
      for (const path of ALL_PATHS) {
        const purpose = KEYWORD_CURATION_PATH_PURPOSE[path];
        expect(typeof purpose).toBe('string');
        expect(purpose.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('KEYWORD_CURATION_INTRO', () => {
    it('is a non-empty string', () => {
      expect(typeof KEYWORD_CURATION_INTRO).toBe('string');
      expect(KEYWORD_CURATION_INTRO.trim().length).toBeGreaterThan(0);
    });

    it('mentions the human-verification gate before any DB write (requirement 3.2)', () => {
      // 不綁死措辭，但須同時包含「人為確認/人工確認」與「才會寫入/才寫入資料庫」
      // 兩個概念，證明文字確實傳達「AI 僅產生建議，人工確認後才會寫入資料庫」。
      const mentionsHumanConfirmation = /(人工|人為).{0,6}(確認|審核|驗證)/.test(KEYWORD_CURATION_INTRO);
      const mentionsBeforeWrite = /(才會?(寫入|提交|送出)|寫入(資料庫|前)|提交.*(前|後))/.test(
        KEYWORD_CURATION_INTRO,
      );
      expect(mentionsHumanConfirmation, 'must mention human confirmation/verification').toBe(true);
      expect(mentionsBeforeWrite, 'must mention that DB write only happens after confirmation').toBe(true);
    });
  });
});
