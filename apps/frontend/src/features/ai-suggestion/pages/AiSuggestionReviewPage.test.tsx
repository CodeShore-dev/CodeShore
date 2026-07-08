import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

const {
  techSuggestion,
  locationSuggestion,
  reviewedSuggestion,
  approveSuggestion,
  rejectSuggestion,
  createGenerateEventSource,
  updateLlmSettings,
  fetchWorkflowInfo,
} = vi.hoisted(() => {
    const base = {
      action: 'insert' as const,
      target_key: {},
      flagged_for_review: false,
      created_at: '2026-07-01T00:00:00Z',
      reviewed_by: null,
      reviewed_at: null,
      resolution_note: null,
      outcome: null,
    };
    return {
      techSuggestion: {
        ...base,
        id: 's1',
        target_table: 'tech',
        workflow: 'tech_dictionary',
        status: 'pending',
        payload: { name: 'react', category: 'frontend' },
        evidence: {
          reasoning: '與既有技術高度相似',
          confidence: 0.42,
          needsVerification: true,
          similarItems: [{ id: 'react-native', label: 'React Native', score: 0.8 }],
        },
      },
      locationSuggestion: {
        ...base,
        id: 's2',
        target_table: 'location_group',
        workflow: 'location_mapping',
        status: 'pending',
        payload: { name: '台北市' },
        evidence: { reasoning: '異常地點字串', affectedCount: 7 },
      },
      // Already-reviewed record (requirement 10.1/10.2): a historical
      // suggestion carrying reviewer/review-time/resolution-note, only ever
      // visible once the status filter is switched off "pending".
      reviewedSuggestion: {
        ...base,
        id: 's3',
        target_table: 'tech_keyword',
        workflow: 'keyword_mapping',
        status: 'rejected',
        payload: { keyword: 'reactjs', tech: 'react' },
        evidence: { reasoning: '信心分數過低', confidence: 0.1 },
        reviewed_by: 'admin-1',
        reviewed_at: '2026-07-05T10:00:00Z',
        resolution_note: '重複建議，已有相同映射',
      },
      approveSuggestion: vi.fn(),
      rejectSuggestion: vi.fn(),
      createGenerateEventSource: vi.fn(() => ({
        close: vi.fn(),
      })),
      updateLlmSettings: vi.fn(),
      fetchWorkflowInfo: vi.fn(async () => [
        {
          workflow: 'keyword_mapping',
          label: '關鍵字對應技術',
          steps: [
            {
              stepLabel: '關鍵字→技術映射',
              toolName: 'classify_keyword_to_tech',
              systemPrompt: 'You classify keywords...',
              inputSchema: { type: 'object' },
            },
          ],
        },
      ]),
    };
  });

vi.mock('../service', () => {
  const state = {
    suggestions: [
      techSuggestion,
      locationSuggestion,
      reviewedSuggestion,
    ] as Array<
      typeof techSuggestion | typeof locationSuggestion | typeof reviewedSuggestion
    >,
  };
  return {
    fetchSuggestions: vi.fn(
      async (filter: { targetTable?: string; status?: string }) => {
        const result = state.suggestions.filter(
          s =>
            (!filter?.targetTable || s.target_table === filter.targetTable) &&
            (!filter?.status || s.status === filter.status),
        );
        return { result, count: result.length };
      },
    ),
    fetchSuggestion: vi.fn(async (id: string) =>
      state.suggestions.find(s => s.id === id),
    ),
    approveSuggestion: vi.fn(async (id: string) => {
      approveSuggestion(id);
      const target = state.suggestions.find(s => s.id === id);
      if (target) target.status = 'approved';
      return target;
    }),
    rejectSuggestion: vi.fn(async (id: string, note?: string) => {
      rejectSuggestion(id, note);
      const target = state.suggestions.find(s => s.id === id);
      if (target) target.status = 'rejected';
      return target;
    }),
    createGenerateEventSource,
    fetchLlmSettings: vi.fn(async () => ({ defaultModel: 'openai/gpt-4o-mini' })),
    updateLlmSettings: vi.fn(async (defaultModel: string) => {
      updateLlmSettings(defaultModel);
      return { defaultModel };
    }),
    fetchWorkflowInfo,
    __resetState: () => {
      state.suggestions = [
        { ...techSuggestion, status: 'pending' },
        { ...locationSuggestion, status: 'pending' },
        { ...reviewedSuggestion },
      ];
    },
  };
});

import * as serviceModule from '../service';
import { AiSuggestionReviewPage } from './AiSuggestionReviewPage';

describe('AiSuggestionReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      serviceModule as unknown as { __resetState: () => void }
    ).__resetState();
  });

  it('renders the pending suggestions list by default (requirement 7.1)', async () => {
    renderWithProviders(<AiSuggestionReviewPage />);

    const card1 = await screen.findByTestId('suggestion-s1');
    const card2 = screen.getByTestId('suggestion-s2');
    expect(card1).toBeInTheDocument();
    expect(card2).toBeInTheDocument();
    expect(within(card1).getByText('技術字典')).toBeInTheDocument();
    expect(within(card2).getByText('地點群組')).toBeInTheDocument();
  });

  it('updates the rendered list when filtering by targetTable (requirement 7.1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    await user.selectOptions(
      screen.getByTestId('filter-target-table'),
      'tech',
    );

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-s1')).toBeInTheDocument();
      expect(screen.queryByTestId('suggestion-s2')).not.toBeInTheDocument();
    });
  });

  it('setting the date-range filter inputs triggers a query with createdAfter/createdBefore (requirement 10.2)', async () => {
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    fireEvent.change(screen.getByTestId('filter-created-after'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByTestId('filter-created-before'), {
      target: { value: '2026-06-30' },
    });

    await waitFor(() => {
      expect(serviceModule.fetchSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAfter: '2026-01-01',
          createdBefore: '2026-06-30',
        }),
      );
    });
  });

  it('renders evidence conditionally by shape (requirement 8.1-8.4)', async () => {
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    const techCard = screen.getByTestId('suggestion-s1');
    expect(techCard.querySelector('[data-testid="evidence-confidence"]'))
      .toBeInTheDocument();
    expect(
      techCard.querySelector('[data-testid="evidence-needs-verification"]'),
    ).toBeInTheDocument();
    expect(
      techCard.querySelector('[data-testid="evidence-similar-items"]'),
    ).toBeInTheDocument();
    expect(
      techCard.querySelector('[data-testid="evidence-affected-count"]'),
    ).not.toBeInTheDocument();

    const locationCard = screen.getByTestId('suggestion-s2');
    expect(
      locationCard.querySelector('[data-testid="evidence-affected-count"]'),
    ).toBeInTheDocument();
    expect(
      locationCard.querySelector('[data-testid="evidence-confidence"]'),
    ).not.toBeInTheDocument();
  });

  it('approving a suggestion removes it from the pending list (requirement 7.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    await user.click(screen.getByTestId('approve-s1'));

    expect(approveSuggestion).toHaveBeenCalledWith('s1');
    await waitFor(() => {
      expect(screen.queryByTestId('suggestion-s1')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('suggestion-s2')).toBeInTheDocument();
  });

  it('approving with an edited payload sends the edited content (requirement 7.4)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    await user.click(screen.getByTestId('approve-edit-s1'));
    const editor = screen.getByTestId('payload-editor-s1');
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({ name: 'react', category: 'backend' }),
      },
    });
    await user.click(screen.getByTestId('confirm-approve-s1'));

    await waitFor(() => {
      expect(serviceModule.approveSuggestion).toHaveBeenCalledWith('s1', {
        name: 'react',
        category: 'backend',
      });
    });
  });

  it('rejecting a suggestion removes it from the pending list (requirement 7.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s2');

    await user.click(screen.getByTestId('reject-s2'));
    await user.click(screen.getByTestId('confirm-reject-s2'));

    expect(rejectSuggestion).toHaveBeenCalledWith('s2', undefined);
    await waitFor(() => {
      expect(screen.queryByTestId('suggestion-s2')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('suggestion-s1')).toBeInTheDocument();
  });

  it('walks through a full review flow: filtering narrows the queue, then acting on the filtered suggestion removes it from the pending view (requirement 7.1-7.4 as one coherent flow)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');
    expect(screen.getByTestId('suggestion-s2')).toBeInTheDocument();

    // 1) Filter narrows what's shown to only the location suggestion.
    await user.selectOptions(
      screen.getByTestId('filter-target-table'),
      'location_group',
    );
    await waitFor(() => {
      expect(screen.queryByTestId('suggestion-s1')).not.toBeInTheDocument();
      expect(screen.getByTestId('suggestion-s2')).toBeInTheDocument();
    });

    // 2) Acting on the now-filtered suggestion: reject with a note.
    const locationCard = screen.getByTestId('suggestion-s2');
    await user.click(within(locationCard).getByTestId('reject-s2'));
    const noteField = within(locationCard).getByRole('textbox');
    await user.type(noteField, '地點名稱重複');
    await user.click(within(locationCard).getByTestId('confirm-reject-s2'));

    expect(rejectSuggestion).toHaveBeenCalledWith('s2', '地點名稱重複');

    // 3) It leaves the pending view: the filter is still active, and the
    // filtered (now-rejected) suggestion is gone -- an empty state shows
    // rather than any pending card.
    await waitFor(() => {
      expect(screen.queryByTestId('suggestion-s2')).not.toBeInTheDocument();
      expect(
        screen.getByText('目前沒有符合篩選條件的建議。'),
      ).toBeInTheDocument();
    });

    // 4) Clearing the target-table filter confirms s2 is gone specifically
    // because it left the `pending` status, not because of the filter.
    await user.selectOptions(screen.getByTestId('filter-target-table'), '');
    await waitFor(() => {
      expect(screen.getByTestId('suggestion-s1')).toBeInTheDocument();
      expect(screen.queryByTestId('suggestion-s2')).not.toBeInTheDocument();
    });
  });

  it('querying by status="rejected" surfaces historical suggestions with reviewer, review time, and resolution note (requirement 10.1, 10.2)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    // Default view is pending-only: the already-reviewed record is absent.
    expect(screen.queryByTestId('suggestion-s3')).not.toBeInTheDocument();

    // Switching the existing status filter to "已駁回" queries history.
    await user.selectOptions(screen.getByTestId('filter-status'), 'rejected');

    const historyCard = await screen.findByTestId('suggestion-s3');
    expect(within(historyCard).getByText('已駁回')).toBeInTheDocument();

    // Expanding detail reveals reviewer/review-time/resolution-note.
    await user.click(within(historyCard).getByText('查看詳情'));
    await waitFor(() => {
      expect(historyCard.textContent).toContain('審核者：admin-1');
      expect(historyCard.textContent).toContain(
        '審核時間：2026-07-05T10:00:00Z',
      );
      expect(historyCard.textContent).toContain(
        '備註：重複建議，已有相同映射',
      );
    });

    // The reviewed record has no approve/reject actions -- it's read-only.
    expect(
      within(historyCard).queryByTestId('approve-s3'),
    ).not.toBeInTheDocument();
    expect(
      within(historyCard).queryByTestId('reject-s3'),
    ).not.toBeInTheDocument();
  });

  it('displays the fetched default LLM model, and saving an edit calls the update mutation (後台可調整預設值)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    expect(await screen.findByTestId('llm-default-model-value')).toHaveTextContent(
      'openai/gpt-4o-mini',
    );

    await user.click(screen.getByTestId('llm-default-model-edit'));
    const input = screen.getByTestId('llm-default-model-input');
    await user.clear(input);
    await user.type(input, 'anthropic/claude-3.5-sonnet');
    await user.click(screen.getByTestId('llm-default-model-save'));

    await waitFor(() => {
      expect(updateLlmSettings).toHaveBeenCalledWith(
        'anthropic/claude-3.5-sonnet',
      );
    });
  });

  it('triggering generate with a model override passes it through to createGenerateEventSource', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    await user.type(
      screen.getByTestId('model-override-input'),
      'meta-llama/llama-3.3-70b-instruct:free',
    );
    await user.click(screen.getByTestId('generate-button'));

    await waitFor(() => {
      expect(createGenerateEventSource).toHaveBeenCalledWith(
        undefined,
        'meta-llama/llama-3.3-70b-instruct:free',
      );
    });
  });

  it('the workflow-info transparency panel starts collapsed and expands on toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    expect(screen.queryByTestId('workflow-info-panel')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('workflow-info-toggle'));

    expect(await screen.findByTestId('workflow-info-panel')).toBeInTheDocument();
    expect(fetchWorkflowInfo).toHaveBeenCalled();
  });

  it('triggering generate with no model override leaves it undefined, not an empty string', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    await user.click(screen.getByTestId('generate-button'));

    await waitFor(() => {
      expect(createGenerateEventSource).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  it('selecting suggestions via checkbox and clicking 核准選取 bulk-approves exactly the selected ids', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');
    expect(screen.getByTestId('suggestion-s2')).toBeInTheDocument();

    // Only pending suggestions get a selection checkbox.
    expect(screen.getByTestId('select-s1')).toBeInTheDocument();
    expect(screen.getByTestId('select-s2')).toBeInTheDocument();

    await user.click(screen.getByTestId('select-s1'));
    const bulkApproveButton = screen.getByTestId('bulk-approve');
    expect(bulkApproveButton).not.toBeDisabled();

    await user.click(bulkApproveButton);

    expect(approveSuggestion).toHaveBeenCalledWith('s1');
    expect(approveSuggestion).not.toHaveBeenCalledWith('s2');
    await waitFor(() => {
      expect(screen.queryByTestId('suggestion-s1')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('suggestion-s2')).toBeInTheDocument();
  });

  it('全選 selects every pending suggestion, and 刪除選取 bulk-rejects them all', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');
    await screen.findByTestId('suggestion-s2');

    await user.click(screen.getByTestId('select-all-suggestions'));
    await user.click(screen.getByTestId('bulk-reject'));

    expect(rejectSuggestion).toHaveBeenCalledWith('s1', undefined);
    expect(rejectSuggestion).toHaveBeenCalledWith('s2', undefined);
    await waitFor(() => {
      expect(screen.queryByTestId('suggestion-s1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('suggestion-s2')).not.toBeInTheDocument();
    });
  });

  it('the bulk action buttons stay disabled until at least one suggestion is selected', async () => {
    renderWithProviders(<AiSuggestionReviewPage />);
    await screen.findByTestId('suggestion-s1');

    expect(screen.getByTestId('bulk-approve')).toBeDisabled();
    expect(screen.getByTestId('bulk-reject')).toBeDisabled();
  });
});
