import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KEYWORD_CURATION_INTRO } from '../content/aiWorkflows';
import type { KeywordCurationWorkflowInfo } from '../service';
import { KeywordCurationWorkflowPanel } from './KeywordCurationWorkflowPanel';

const MOCK_INFO: KeywordCurationWorkflowInfo = {
  toolName: 'classify_keyword',
  systemPrompt:
    '你是一個負責將候選關鍵字分類至路徑 A/B/C 的助理，請根據提供的關鍵字與既有技術字典判斷最合適的路徑。',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', enum: ['A', 'B', 'C'] },
    },
    required: ['path'],
  },
  paths: [
    { path: 'A', label: '路徑 A：映射至既有技術條目' },
    { path: 'B', label: '路徑 B：建立新技術條目' },
    { path: 'C', label: '路徑 C：移入 keyword bin' },
  ],
};

describe('KeywordCurationWorkflowPanel', () => {
  it('renders the intro, all 3 path labels with purpose text, and exactly one shared PromptDisclosureBlock', () => {
    render(<KeywordCurationWorkflowPanel info={MOCK_INFO} />);

    // Requirement 3.2: human-verification-gate explanation, via KEYWORD_CURATION_INTRO.
    expect(screen.getByText(KEYWORD_CURATION_INTRO)).toBeInTheDocument();

    // Requirement 3.1: 3 path labels rendered, each paired with its purpose text.
    for (const path of MOCK_INFO.paths) {
      expect(screen.getByText(path.label)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/候選關鍵字明顯是既有技術條目的同義詞、別名或縮寫/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/候選關鍵字指向一個真實存在、但既有技術字典尚未涵蓋的技術/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/候選關鍵字並非明確指向任何真實技術/),
    ).toBeInTheDocument();

    // Requirement 3.1/3.3: exactly ONE shared PromptDisclosureBlock for the
    // classifier (not one per path) — the toolName/systemPrompt/schema each
    // appear exactly once.
    expect(screen.getAllByText('classify_keyword')).toHaveLength(1);
    expect(screen.getAllByText(MOCK_INFO.systemPrompt)).toHaveLength(1);
    const expectedSchemaJson = JSON.stringify(MOCK_INFO.inputSchema, null, 2);
    expect(
      screen.getAllByText(expectedSchemaJson, { normalizer: text => text }),
    ).toHaveLength(1);
  });
});
