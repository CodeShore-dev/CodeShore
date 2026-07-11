import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useResumeSessionMutation } = vi.hoisted(() => ({
  useResumeSessionMutation: vi.fn(),
}));
vi.mock('../mutations', () => ({ useResumeSessionMutation }));

const { useTechsQuery } = vi.hoisted(() => ({ useTechsQuery: vi.fn() }));
vi.mock('../../keyword/queries', () => ({ useTechsQuery }));

import { INITIAL_CURATION_STATE, useCurationStore } from '../curationStore';
import type { AiRecommendation, CommitResult } from '../service';
import { CurationSession } from './CurationSession';

const pathAInterrupt: AiRecommendation = {
  path: 'A',
  matchedTech: { id: 'reactjs', label: 'React', category: 'framework' },
  confidence: 0.92,
  reasoning: 'strong lexical match',
  affectedJobCount: 12,
};

const pathBInterrupt: AiRecommendation = {
  path: 'B',
  suggestedTech: {
    id: 'newlib',
    label: 'NewLib',
    category: 'framework',
    tags: [],
    iconSlugs: [],
  },
  suggestedEdges: [],
  reasoning: 'no existing match',
  affectedJobCount: 5,
};

const pathCInterrupt: AiRecommendation = {
  path: 'C',
  reasoning: 'looks like noise',
  affectedJobCount: 2,
};

const aiFailedInterrupt: AiRecommendation = {
  path: 'ai_failed',
  error: 'LLM timeout',
};

const successResult: CommitResult = {
  ok: true,
  changes: [
    {
      type: 'tech_keyword',
      details: { keyword: 'reactjs', techId: 'reactjs' },
      status: 'committed',
    },
  ],
};

const partialFailureResult: CommitResult = {
  ok: false,
  error: 'parent-child write failed',
  partialChanges: [
    { type: 'tech', details: { id: 'newtech' }, status: 'committed' },
    {
      type: 'tech_parent',
      details: { parentId: 'newtech', childId: 'reactjs' },
      status: 'failed',
      error: 'constraint violation',
    },
  ],
};

// CurationSession (task 6.7, requirements 2.2, 2.3, 3.5, 8.1, 9.1-9.3): the
// session state-machine view -- one of 5 mutually-exclusive renders based on
// curationStore.sessionStatus. Covers the task's literal completion
// criteria: each of the 5 statuses renders its distinguishing content, and
// the `done` status renders a distinct failed badge for a partialChanges
// entry with status: 'failed' (alongside a distinct committed badge for the
// other entry).
describe('CurationSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCurationStore.setState(INITIAL_CURATION_STATE);
    useResumeSessionMutation.mockReturnValue({ mutate: vi.fn() });
    useTechsQuery.mockReturnValue({ data: [] });
  });

  it('idle: renders a neutral placeholder prompting the admin to pick a keyword', () => {
    render(<CurationSession />);

    expect(
      screen.getByText('請從左側選擇一個 keyword 開始策展'),
    ).toBeInTheDocument();
  });

  it('loading: renders a loading indicator with the in-progress keyword name', () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'loading',
      activeKeyword: 'vuejs',
    });

    render(<CurationSession />);

    expect(screen.getByTestId('curation-session-loading')).toBeInTheDocument();
    expect(screen.getByText('vuejs')).toBeInTheDocument();
  });

  it('interrupted: renders AiRecommendationCard and the path-matching decision form (path C)', () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'jquery',
      threadId: 'thread-1',
      interrupt: pathCInterrupt,
    });

    render(<CurationSession />);

    // AiRecommendationCard's path C badge
    expect(screen.getByText('路徑 C · 放入 keyword bin')).toBeInTheDocument();
    // PathCDecisionForm
    expect(
      screen.getByRole('button', { name: '確認放入 Keyword Bin' }),
    ).toBeInTheDocument();
    // CommitPreviewPanel
    expect(screen.getByTestId('commit-preview-panel')).toBeInTheDocument();
  });

  it('interrupted: renders PathADecisionForm pre-filled with the AI-suggested tech for a path A interrupt', () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'reactjs',
      threadId: 'thread-1',
      interrupt: pathAInterrupt,
    });

    useTechsQuery.mockReturnValue({
      data: [{ tech: 'reactjs', label: 'React', category: 'framework' }],
    });

    render(<CurationSession />);

    expect(screen.getByText('路徑 A · 映射既有技術')).toBeInTheDocument();
    const select = screen.getByLabelText('目標技術') as HTMLSelectElement;
    expect(select.value).toBe('reactjs');
  });

  it('interrupted: live-editing PathADecisionForm\'s selection updates CommitPreviewPanel to the newly-selected tech, not the original AI suggestion (requirement 4.1, 5.1, 6.6)', async () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'reactjs',
      threadId: 'thread-1',
      interrupt: pathAInterrupt,
    });
    useTechsQuery.mockReturnValue({
      data: [
        { tech: 'reactjs', label: 'React', category: 'framework' },
        { tech: 'vuejs', label: 'Vue', category: 'framework' },
      ],
    });
    const user = userEvent.setup();

    render(<CurationSession />);

    // Before any edit, the preview reflects the AI's suggested tech.
    expect(screen.getByTestId('preview-mapping-row')).toHaveTextContent(
      'reactjs → reactjs 映射',
    );

    const select = screen.getByLabelText('目標技術') as HTMLSelectElement;
    await user.selectOptions(select, 'vuejs');

    // After the admin overrides the selection, the preview must reflect the
    // NEW selection, not the stale AI default.
    expect(screen.getByTestId('preview-mapping-row')).toHaveTextContent(
      'reactjs → vuejs 映射',
    );
  });

  it('interrupted: live-editing PathBDecisionForm\'s label updates CommitPreviewPanel to reflect the edited field (requirement 4.1, 5.1, 6.6)', async () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'newlib-kw',
      threadId: 'thread-1',
      interrupt: pathBInterrupt,
    });
    const user = userEvent.setup();

    render(<CurationSession />);

    expect(screen.getByTestId('preview-new-tech')).toHaveTextContent('名稱：NewLib');

    const labelInput = screen.getByLabelText('名稱');
    await user.clear(labelInput);
    await user.type(labelInput, 'Edited Label');

    expect(screen.getByTestId('preview-new-tech')).toHaveTextContent(
      '名稱：Edited Label',
    );
  });

  it('interrupted: cancelling a real path C recommendation shows the fallback A/B/C selector, and picking A then renders PathADecisionForm (requirement 4.4)', async () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'jquery',
      threadId: 'thread-1',
      interrupt: pathCInterrupt,
    });
    useTechsQuery.mockReturnValue({ data: [] });
    const user = userEvent.setup();

    render(<CurationSession />);

    expect(
      screen.getByRole('button', { name: '確認放入 Keyword Bin' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));

    // The local fallback selector (distinct from AiRecommendationCard's own
    // manual-path buttons, which only render for the ai_failed case) appears
    // once the admin cancels out of a real recommendation.
    expect(screen.getByText('請選擇路徑')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '確認放入 Keyword Bin' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'A · 映射既有技術' }));

    expect(screen.getByLabelText('目標技術')).toBeInTheDocument();
  });

  it('interrupted: submitting the path C decision form resumes the session with the threadId and decision', async () => {
    const mutate = vi.fn();
    useResumeSessionMutation.mockReturnValue({ mutate });
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'jquery',
      threadId: 'thread-1',
      interrupt: pathCInterrupt,
    });
    const user = userEvent.setup();

    render(<CurationSession />);
    await user.click(screen.getByRole('button', { name: '確認放入 Keyword Bin' }));

    expect(mutate).toHaveBeenCalledWith({
      threadId: 'thread-1',
      decision: { path: 'C' },
    });
  });

  it('interrupted: ai_failed shows the manual path selector, and picking C renders PathCDecisionForm', async () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'foobar',
      threadId: 'thread-2',
      interrupt: aiFailedInterrupt,
    });
    const user = userEvent.setup();

    render(<CurationSession />);

    expect(screen.getByText('AI 分析失敗')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '確認放入 Keyword Bin' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'C · 放入 keyword bin' }));

    expect(
      screen.getByRole('button', { name: '確認放入 Keyword Bin' }),
    ).toBeInTheDocument();
  });

  it('done: renders CommitResult.changes with a committed badge and a "下一個" button', () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'done',
      activeKeyword: 'reactjs',
      commitResult: successResult,
    });

    render(<CurationSession />);

    expect(screen.getByTestId('commit-status-badge-committed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一個' })).toBeInTheDocument();
  });

  it('done: clicking "下一個" resets the session back to idle', async () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'done',
      activeKeyword: 'reactjs',
      commitResult: successResult,
    });
    const user = userEvent.setup();

    render(<CurationSession />);
    await user.click(screen.getByRole('button', { name: '下一個' }));

    expect(useCurationStore.getState().sessionStatus).toBe('idle');
  });

  it('done: renders a distinct failed badge for a partialChanges entry with status "failed" (alongside a committed badge for the other entry)', () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'done',
      activeKeyword: 'newtech-kw',
      commitResult: partialFailureResult,
    });

    render(<CurationSession />);

    const rows = screen.getAllByTestId('commit-change-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByTestId('commit-status-badge-committed')).toBeInTheDocument();
    expect(screen.getByTestId('commit-status-badge-failed')).toBeInTheDocument();
    expect(screen.getByTestId('commit-status-badge-failed')).toHaveTextContent('失敗');
    expect(screen.getByText('parent-child write failed')).toBeInTheDocument();
  });

  it('error: renders the errorMessage and a "重試" button', () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'error',
      activeKeyword: 'reactjs',
      errorMessage: 'network down',
    });

    render(<CurationSession />);

    expect(screen.getByText('network down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重試' })).toBeInTheDocument();
  });

  it('error: clicking "重試" with no prior decision resets the session back to idle', async () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'error',
      activeKeyword: 'reactjs',
      errorMessage: 'AI analysis failed',
    });
    const user = userEvent.setup();

    render(<CurationSession />);
    await user.click(screen.getByRole('button', { name: '重試' }));

    expect(useCurationStore.getState().sessionStatus).toBe('idle');
  });

  it('error: renders a "略過此 keyword" button alongside "重試" (requirement 9.1)', () => {
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'error',
      activeKeyword: 'reactjs',
      errorMessage: 'network down',
    });

    render(<CurationSession />);

    expect(screen.getByRole('button', { name: '重試' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '略過此 keyword' }),
    ).toBeInTheDocument();
  });

  it('error: clicking "略過此 keyword" resets the session back to idle without re-submitting or resuming (requirement 9.1)', async () => {
    const mutate = vi.fn();
    useResumeSessionMutation.mockReturnValue({ mutate });
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'error',
      activeKeyword: 'jquery',
      threadId: 'thread-1',
      errorMessage: 'write failed',
    });
    const user = userEvent.setup();

    render(<CurationSession />);
    await user.click(screen.getByRole('button', { name: '略過此 keyword' }));

    expect(useCurationStore.getState().sessionStatus).toBe('idle');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('error: clicking "重試" after a failed resume re-submits the same threadId/decision', async () => {
    const mutate = vi.fn();
    useResumeSessionMutation.mockReturnValue({ mutate });
    useCurationStore.setState({
      ...INITIAL_CURATION_STATE,
      sessionStatus: 'interrupted',
      activeKeyword: 'jquery',
      threadId: 'thread-1',
      interrupt: pathCInterrupt,
    });
    const user = userEvent.setup();

    render(<CurationSession />);
    await user.click(screen.getByRole('button', { name: '確認放入 Keyword Bin' }));
    expect(mutate).toHaveBeenCalledWith({
      threadId: 'thread-1',
      decision: { path: 'C' },
    });

    // Simulate the mutation's onError handler moving the store to 'error'
    // (useResumeSessionMutation is mocked here, so this mirrors what the
    // real hook's onError callback does per mutations.ts). Wrapped in act()
    // since this update happens outside any React event handler.
    act(() => {
      useCurationStore.setState({ sessionStatus: 'error', errorMessage: 'write failed' });
    });

    await user.click(screen.getByRole('button', { name: '重試' }));

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenLastCalledWith({
      threadId: 'thread-1',
      decision: { path: 'C' },
    });
  });
});
