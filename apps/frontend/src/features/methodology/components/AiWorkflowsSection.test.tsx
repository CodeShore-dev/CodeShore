import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import type { AiWorkflowsResponse } from '../service';

const { fetchAiWorkflows } = vi.hoisted(() => ({
  fetchAiWorkflows: vi.fn(),
}));

vi.mock('../service', () => ({ fetchAiWorkflows }));

import { AiWorkflowsSection } from './AiWorkflowsSection';

// Mirrors the real AiWorkflowsResponse shape closely enough to prove both
// child components (AiSuggestionWorkflowList, KeywordCurationWorkflowPanel)
// actually render their data — one ai-suggestion workflow (identifiable via
// its label) and the keyword-curation panel (identifiable via its static
// intro paragraph, which only that subtree renders).
const MOCK_RESPONSE: AiWorkflowsResponse = {
  aiSuggestion: [
    {
      workflow: 'keyword_mapping',
      label: '關鍵字對應技術',
      steps: [
        {
          stepLabel: '關鍵字→技術映射',
          toolName: 'classify_keyword_to_tech',
          systemPrompt: 'system prompt for keyword mapping',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    },
  ],
  keywordCuration: {
    toolName: 'classify_keyword',
    systemPrompt: 'system prompt for classifier',
    inputSchema: { type: 'object', properties: {} },
    paths: [
      { path: 'A', label: '路徑 A：映射至既有技術條目' },
      { path: 'B', label: '路徑 B：建立新技術條目' },
      { path: 'C', label: '路徑 C：移入 keyword bin' },
    ],
  },
};

describe('AiWorkflowsSection (req 2.4, 2.5, 3.4, 3.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading hint while the query is pending (req 2.4, 3.4)', () => {
    // Never-resolving promise keeps the query in the pending state for the
    // lifetime of this synchronous assertion.
    fetchAiWorkflows.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AiWorkflowsSection />);

    expect(screen.getByText('AI 工作流程資料載入中…')).toBeInTheDocument();
  });

  it('shows an error hint when the query rejects, without throwing (req 2.5, 3.5)', async () => {
    fetchAiWorkflows.mockRejectedValue(new Error('network error'));

    renderWithProviders(<AiWorkflowsSection />);

    // The test completing without an uncaught exception is itself evidence
    // that the rejection was captured by useQuery's isError state, not thrown.
    expect(
      await screen.findByText('無法取得 AI 工作流程資料'),
    ).toBeInTheDocument();
  });

  it('renders both AiSuggestionWorkflowList and KeywordCurationWorkflowPanel on success', async () => {
    fetchAiWorkflows.mockResolvedValue(MOCK_RESPONSE);

    renderWithProviders(<AiWorkflowsSection />);

    // AiSuggestionWorkflowList content.
    expect(await screen.findByText('關鍵字對應技術')).toBeInTheDocument();
    expect(
      screen.getByText('classify_keyword_to_tech'),
    ).toBeInTheDocument();

    // KeywordCurationWorkflowPanel content (its static intro paragraph is
    // unique to that subtree).
    expect(
      screen.getByText(/keyword 策展」是一套引導式流程/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('路徑 A：映射至既有技術條目'),
    ).toBeInTheDocument();
  });

  it('gives the section id="ai-workflows" for the nav/deep-link mount point (req 1.1, 1.2)', () => {
    fetchAiWorkflows.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<AiWorkflowsSection />);

    expect(container.querySelector('#ai-workflows')).not.toBeNull();
  });
});
