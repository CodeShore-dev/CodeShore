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

function setup(selected = '未分類') {
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  render(
    <JobPreferenceReasonOptionList
      options={options}
      selected={selected}
      onSelect={onSelect}
      onDelete={onDelete}
    />,
  );
  return { onSelect, onDelete, user: userEvent.setup() };
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
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('calls onDelete with the option without changing selection', async () => {
    const { onSelect, onDelete, user } = setup();
    await user.click(screen.getByRole('button', { name: '刪除「遠端工作」' }));
    expect(onDelete).toHaveBeenCalledWith(options[1]);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
