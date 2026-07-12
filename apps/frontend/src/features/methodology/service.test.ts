import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../httpClient', () => ({
  httpClient: { get },
}));

import { fetchAiWorkflows } from './service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchAiWorkflows', () => {
  it('calls GET /api/methodology/ai-workflows and returns the response data verbatim', async () => {
    const data = {
      aiSuggestion: [
        {
          workflow: 'keyword_mapping',
          label: '關鍵字對應技術',
          steps: [
            {
              stepLabel: '關鍵字→技術映射',
              toolName: 'classify_keyword',
              systemPrompt: 'You are...',
              inputSchema: { type: 'object' },
            },
          ],
        },
      ],
      keywordCuration: {
        toolName: 'classify_curation_path',
        systemPrompt: 'You decide...',
        inputSchema: { type: 'object' },
        paths: [
          { path: 'A', label: '映射至既有技術條目' },
          { path: 'B', label: '建立新技術條目' },
          { path: 'C', label: '移入 keyword bin' },
        ],
      },
    };
    get.mockResolvedValue({ data });

    const result = await fetchAiWorkflows();

    expect(get).toHaveBeenCalledWith('/api/methodology/ai-workflows');
    expect(result).toEqual(data);
    expect(result).toBe(data);
  });
});
