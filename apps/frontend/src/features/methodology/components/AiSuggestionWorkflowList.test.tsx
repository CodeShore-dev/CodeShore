import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AiSuggestionWorkflowInfo } from '../service';
import { AiSuggestionWorkflowList } from './AiSuggestionWorkflowList';

const buildStep = (stepLabel: string) => ({
  stepLabel,
  toolName: `tool_${stepLabel}`,
  systemPrompt: `system prompt for ${stepLabel}`,
  inputSchema: { type: 'object', properties: {} },
});

const MOCK_WORKFLOWS: readonly AiSuggestionWorkflowInfo[] = [
  {
    workflow: 'keyword_mapping',
    label: '關鍵字對應技術',
    steps: [buildStep('keyword_mapping step')],
  },
  {
    workflow: 'tech_dictionary',
    label: '技術字典補全',
    steps: [buildStep('tech_dictionary step')],
  },
  {
    workflow: 'tech_hierarchy',
    label: '技術父子階層',
    steps: [buildStep('tech_hierarchy step')],
  },
  {
    workflow: 'location_mapping',
    label: '地點正規化',
    steps: [buildStep('location_mapping step')],
  },
  {
    workflow: 'noise_detection',
    label: '排除清單雜訊偵測',
    steps: [
      buildStep('noise_detection step 1'),
      buildStep('noise_detection step 2'),
    ],
  },
];

describe('AiSuggestionWorkflowList', () => {
  it('renders all 5 workflow labels, their purpose text, and one PromptDisclosureBlock per step (noise_detection renders 2)', () => {
    render(<AiSuggestionWorkflowList workflows={MOCK_WORKFLOWS} />);

    for (const workflow of MOCK_WORKFLOWS) {
      expect(screen.getByText(workflow.label)).toBeInTheDocument();
    }

    // Purpose text sourced from AI_SUGGESTION_WORKFLOW_PURPOSE, keyed by workflow id.
    expect(
      screen.getByText(
        /將職缺描述萃取出、出現頻率已達門檻但尚未對應任何技術字典項目的關鍵字/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/從兩個角度偵測資料雜訊/),
    ).toBeInTheDocument();

    // 4 workflows x 1 step + noise_detection x 2 steps = 6 rendered PromptDisclosureBlocks,
    // each identifiable by its distinct step tool name.
    expect(screen.getByText('tool_keyword_mapping step')).toBeInTheDocument();
    expect(screen.getByText('tool_tech_dictionary step')).toBeInTheDocument();
    expect(screen.getByText('tool_tech_hierarchy step')).toBeInTheDocument();
    expect(screen.getByText('tool_location_mapping step')).toBeInTheDocument();
    expect(
      screen.getByText('tool_noise_detection step 1'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('tool_noise_detection step 2'),
    ).toBeInTheDocument();

    const renderedToolNames = screen.getAllByText(/^tool_/);
    expect(renderedToolNames).toHaveLength(6);
  });
});
