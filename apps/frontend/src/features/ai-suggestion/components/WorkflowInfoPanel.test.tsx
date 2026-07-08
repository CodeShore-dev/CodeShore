import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

const { fetchWorkflowInfo } = vi.hoisted(() => ({
  fetchWorkflowInfo: vi.fn(),
}));

vi.mock('../service', () => ({ fetchWorkflowInfo }));

import { WorkflowInfoPanel } from './WorkflowInfoPanel';

// Mirrors the 5 real workflows/their steps' shape (task requirement: 5
// entries, `noise_detection` has 2 steps, the rest have 1).
const WORKFLOW_INFO_FIXTURE = [
  {
    workflow: 'keyword_mapping',
    label: '關鍵字對應技術',
    steps: [
      {
        stepLabel: '關鍵字→技術映射',
        toolName: 'classify_keyword_to_tech',
        systemPrompt: 'You classify keywords extracted from job descriptions...',
        inputSchema: { type: 'object', properties: { matchedTechId: { type: 'string' } } },
      },
    ],
  },
  {
    workflow: 'tech_dictionary',
    label: '技術字典補全',
    steps: [
      {
        stepLabel: '技術字典補全與修正',
        toolName: 'propose_tech_dictionary_changes',
        systemPrompt: 'You maintain a standardized technology dictionary...',
        inputSchema: { type: 'object' },
      },
    ],
  },
  {
    workflow: 'tech_hierarchy',
    label: '技術父子階層',
    steps: [
      {
        stepLabel: '技術父子階層提案',
        toolName: 'propose_tech_hierarchy_edges',
        systemPrompt: 'You maintain a parent/child hierarchy...',
        inputSchema: { type: 'object' },
      },
    ],
  },
  {
    workflow: 'location_mapping',
    label: '地點正規化',
    steps: [
      {
        stepLabel: '地點字串正規化',
        toolName: 'propose_location_mappings',
        systemPrompt: 'You maintain a normalization mapping...',
        inputSchema: { type: 'object' },
      },
    ],
  },
  {
    workflow: 'noise_detection',
    label: '排除清單雜訊偵測',
    steps: [
      {
        stepLabel: '關鍵字雜訊偵測',
        toolName: 'flag_noise_keywords',
        systemPrompt: 'You maintain the quality of a keyword-frequency statistic...',
        inputSchema: { type: 'object' },
      },
      {
        stepLabel: '職缺描述樣式偵測',
        toolName: 'flag_noise_description_patterns',
        systemPrompt: 'You maintain the quality of keyword extraction...',
        inputSchema: { type: 'object' },
      },
    ],
  },
];

describe('WorkflowInfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWorkflowInfo.mockResolvedValue(WORKFLOW_INFO_FIXTURE);
  });

  it('stays collapsed by default (no panel content, no fetch triggered rendering)', () => {
    renderWithProviders(<WorkflowInfoPanel />);

    expect(screen.getByTestId('workflow-info-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('workflow-info-panel')).not.toBeInTheDocument();
  });

  it('toggling reveals the panel and renders all 5 workflows with their steps', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkflowInfoPanel />);

    await user.click(screen.getByTestId('workflow-info-toggle'));

    const panel = await screen.findByTestId('workflow-info-panel');
    expect(panel).toBeInTheDocument();

    for (const workflow of WORKFLOW_INFO_FIXTURE) {
      await waitFor(() => {
        expect(
          screen.getByTestId(`workflow-info-${workflow.workflow}`),
        ).toBeInTheDocument();
      });
      expect(screen.getByText(workflow.label)).toBeInTheDocument();
      for (const step of workflow.steps) {
        expect(screen.getByText(step.stepLabel)).toBeInTheDocument();
        expect(screen.getByText(step.systemPrompt)).toBeInTheDocument();
        expect(
          screen.getByText(`tool: ${step.toolName}`),
        ).toBeInTheDocument();
      }
    }

    // noise_detection's two independent sub-flows both render as distinct
    // step blocks under the same workflow card.
    const noiseCard = screen.getByTestId('workflow-info-noise_detection');
    expect(noiseCard.textContent).toContain('關鍵字雜訊偵測');
    expect(noiseCard.textContent).toContain('職缺描述樣式偵測');
  });

  it('toggling again hides the panel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkflowInfoPanel />);

    await user.click(screen.getByTestId('workflow-info-toggle'));
    await screen.findByTestId('workflow-info-panel');

    await user.click(screen.getByTestId('workflow-info-toggle'));

    expect(screen.queryByTestId('workflow-info-panel')).not.toBeInTheDocument();
  });
});
