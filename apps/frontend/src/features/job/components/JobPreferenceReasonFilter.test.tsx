import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useJobFilterStore } from '../jobFilterStore';
import { usePreferenceReasonsQuery } from '../queries';
import { JobPreferenceReasonFilter } from './JobPreferenceReasonFilter';

vi.mock('../queries', () => ({
  usePreferenceReasonsQuery: vi.fn(),
}));

const mockedUsePreferenceReasonsQuery = vi.mocked(usePreferenceReasonsQuery);

describe('JobPreferenceReasonFilter (Requirements 7.1, 7.2, 7.3, 7.7)', () => {
  beforeEach(() => {
    useJobFilterStore.getState().reset();
    mockedUsePreferenceReasonsQuery.mockReset();
  });

  it('shows 全部 with a count equal to the sum of every reason job_count', () => {
    mockedUsePreferenceReasonsQuery.mockReturnValue({
      data: [
        { reason: '未分類', job_count: 3 },
        { reason: '技能已符合', job_count: 5 },
        { reason: '差一點', job_count: 2 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<JobPreferenceReasonFilter preference="like" />);

    expect(screen.getByText('全部').closest('button')?.textContent).toContain('10');
  });

  it('hides reasons whose job_count is zero', () => {
    mockedUsePreferenceReasonsQuery.mockReturnValue({
      data: [
        { reason: '未分類', job_count: 3 },
        { reason: '沒人用', job_count: 0 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<JobPreferenceReasonFilter preference="like" />);

    expect(screen.getByText('未分類')).toBeInTheDocument();
    expect(screen.queryByText('沒人用')).not.toBeInTheDocument();
  });

  it('clicking a reason chip selects that reason in the store', async () => {
    const user = userEvent.setup();
    mockedUsePreferenceReasonsQuery.mockReturnValue({
      data: [
        { reason: '未分類', job_count: 3 },
        { reason: '技能已符合', job_count: 5 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<JobPreferenceReasonFilter preference="like" />);

    await user.click(screen.getByText('技能已符合').closest('button')!);

    expect(useJobFilterStore.getState().preferenceReason).toBe('技能已符合');
  });

  it('clicking 全部 resets the selected reason to null', async () => {
    const user = userEvent.setup();
    useJobFilterStore.setState({ preferenceReason: '技能已符合' });
    mockedUsePreferenceReasonsQuery.mockReturnValue({
      data: [
        { reason: '未分類', job_count: 3 },
        { reason: '技能已符合', job_count: 5 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<JobPreferenceReasonFilter preference="like" />);

    await user.click(screen.getByText('全部').closest('button')!);

    expect(useJobFilterStore.getState().preferenceReason).toBeNull();
  });

  it('marks the active chip with aria-pressed=true and others false', () => {
    useJobFilterStore.setState({ preferenceReason: '技能已符合' });
    mockedUsePreferenceReasonsQuery.mockReturnValue({
      data: [
        { reason: '未分類', job_count: 3 },
        { reason: '技能已符合', job_count: 5 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<JobPreferenceReasonFilter preference="like" />);

    const activeChip = screen.getByText('技能已符合').closest('button')!;
    const allChip = screen.getByText('全部').closest('button')!;
    const otherChip = screen.getByText('未分類').closest('button')!;

    expect(activeChip).toHaveAttribute('aria-pressed', 'true');
    expect(allChip).toHaveAttribute('aria-pressed', 'false');
    expect(otherChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('resets the selection to null when the selected reason is missing from loaded data', async () => {
    useJobFilterStore.setState({ preferenceReason: '已刪除的原因' });
    mockedUsePreferenceReasonsQuery.mockReturnValue({
      data: [{ reason: '未分類', job_count: 3 }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<JobPreferenceReasonFilter preference="like" />);

    await waitFor(() => {
      expect(useJobFilterStore.getState().preferenceReason).toBeNull();
    });
  });

  it('does not reset the selection while data is still loading (undefined)', () => {
    useJobFilterStore.setState({ preferenceReason: '技能已符合' });
    mockedUsePreferenceReasonsQuery.mockReturnValue({
      data: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    render(<JobPreferenceReasonFilter preference="like" />);

    expect(useJobFilterStore.getState().preferenceReason).toBe('技能已符合');
  });
});
