import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ReasonOption } from '../buildReasonOptions';
import { JobPreferenceReasonOptionList } from './JobPreferenceReasonOptionList';

const options: ReasonOption[] = [
  { reason: '未分類', jobCount: 12, isDraft: false, deletable: false },
  { reason: '遠端工作', jobCount: 3, isDraft: false, deletable: true },
  { reason: '薪水高', jobCount: 0, isDraft: true, deletable: true },
];

function setup(selected = '未分類', renaming: string | null = null) {
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  const onStartRename = vi.fn();
  const onRename = vi.fn();
  const onCancelRename = vi.fn();
  render(
    <JobPreferenceReasonOptionList
      options={options}
      selected={selected}
      onSelect={onSelect}
      onDelete={onDelete}
      renaming={renaming}
      renameError={null}
      onStartRename={onStartRename}
      onRename={onRename}
      onCancelRename={onCancelRename}
    />,
  );
  return {
    onSelect,
    onDelete,
    onStartRename,
    onRename,
    onCancelRename,
    user: userEvent.setup(),
  };
}

describe('JobPreferenceReasonOptionList', () => {
  it('renders a radio group with every name and its job count (3.2)', () => {
    setup();
    const group = screen.getByRole('radiogroup');
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: '未分類' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '遠端工作' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '薪水高' })).toBeInTheDocument();
    expect(screen.getByTestId('reason-count-未分類')).toHaveTextContent('12');
    expect(screen.getByTestId('reason-count-遠端工作')).toHaveTextContent('3');
    expect(screen.getByTestId('reason-count-薪水高')).toHaveTextContent('0');
  });

  it('checks only the selected option', () => {
    setup('遠端工作');
    expect(screen.getByRole('radio', { name: '遠端工作' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '未分類' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '薪水高' })).not.toBeChecked();
  });

  it('calls onSelect with the reason when a row is clicked', async () => {
    const { onSelect, user } = setup();
    await user.click(screen.getByText('遠端工作'));
    expect(onSelect).toHaveBeenCalledWith('遠端工作');
  });

  it('shows delete buttons only for deletable options (5.1, 5.6)', () => {
    setup();
    expect(screen.queryByRole('button', { name: '刪除「未分類」' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刪除「遠端工作」' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刪除「薪水高」' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^刪除/ })).toHaveLength(2);
  });

  it('calls onDelete with the option without changing selection', async () => {
    const { onSelect, onDelete, user } = setup();
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    expect(onDelete).toHaveBeenCalledWith(options[1]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows ✎ only on deletable server options, not 未分類 or drafts (9.1)', () => {
    setup();
    expect(screen.getByRole('button', { name: '改名「遠端工作」' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '改名「未分類」' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '改名「薪水高」' })).not.toBeInTheDocument();
  });

  it('calls onStartRename without changing selection', async () => {
    const { onStartRename, onSelect, user } = setup();
    await user.click(screen.getByRole('button', { name: '改名「遠端工作」' }));
    expect(onStartRename).toHaveBeenCalledWith('遠端工作');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('replaces the renaming chip with a prefilled input (9.2)', async () => {
    const { onRename, onCancelRename, user } = setup('未分類', '遠端工作');
    expect(screen.queryByRole('radio', { name: '遠端工作' })).not.toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: '新名稱' });
    expect(input).toHaveValue('遠端工作');
    await user.clear(input);
    await user.type(input, '在家{Enter}');
    expect(onRename).toHaveBeenCalledWith('遠端工作', '在家');
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancelRename).toHaveBeenCalledTimes(1);
  });
});
