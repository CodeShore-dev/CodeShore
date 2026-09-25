import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { RenameError } from '../hooks/useReasonRename';
import { JobPreferenceReasonRenameInput } from './JobPreferenceReasonRenameInput';

function setup(error: RenameError | null = null) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <JobPreferenceReasonRenameInput
      initial="遠端工作"
      error={error}
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
  return { onSave, onCancel, user: userEvent.setup() };
}

describe('JobPreferenceReasonRenameInput', () => {
  it('prefills the current name and focuses the input (9.2)', () => {
    setup();
    const input = screen.getByRole('textbox', { name: '新名稱' });
    expect(input).toHaveValue('遠端工作');
    expect(input).toHaveFocus();
  });

  it('saves the typed value with the 儲存 button', async () => {
    const { user, onSave } = setup();
    const input = screen.getByRole('textbox', { name: '新名稱' });
    await user.clear(input);
    await user.type(input, '在家上班');
    await user.click(screen.getByRole('button', { name: '儲存' }));
    expect(onSave).toHaveBeenCalledWith('在家上班');
  });

  it('saves on Enter', async () => {
    const { user, onSave } = setup();
    await user.type(screen.getByRole('textbox', { name: '新名稱' }), '2{Enter}');
    expect(onSave).toHaveBeenCalledWith('遠端工作2');
  });

  it('ignores Enter during IME composition', () => {
    const { onSave } = setup();
    fireEvent.keyDown(screen.getByRole('textbox', { name: '新名稱' }), {
      key: 'Enter',
      isComposing: true,
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels with the 取消 button', async () => {
    const { user, onCancel, onSave } = setup();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', '請輸入名稱'],
    ['too_long', '最多 20 個字'],
    ['duplicate', '已有同名分類'],
    ['failed', '改名失敗'],
  ] as const)('shows the %s error text (9.4, 9.5, 9.9)', (error, text) => {
    setup(error);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });

  it('shows no error when there is none', () => {
    setup();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
