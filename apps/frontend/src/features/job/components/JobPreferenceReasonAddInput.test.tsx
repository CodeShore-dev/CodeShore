import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { JobPreferenceReasonAddInput } from './JobPreferenceReasonAddInput';

function setup() {
  const onAdd = vi.fn();
  render(<JobPreferenceReasonAddInput onAdd={onAdd} />);
  return {
    onAdd,
    user: userEvent.setup(),
    input: screen.getByRole('textbox', { name: '新增子分類' }),
    button: screen.getByRole('button', { name: '新增' }),
  };
}

describe('JobPreferenceReasonAddInput', () => {
  it('rejects an empty name and shows 請輸入名稱 (4.3)', async () => {
    const { onAdd, user, button } = setup();
    await user.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('請輸入名稱');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only name (4.2, 4.3)', async () => {
    const { onAdd, user, input, button } = setup();
    await user.type(input, '   ');
    await user.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('請輸入名稱');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('rejects a name over 20 characters and shows 最多 20 個字 (4.4)', async () => {
    const { onAdd, user, input, button } = setup();
    await user.type(input, '字'.repeat(21));
    await user.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('最多 20 個字');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('trims a valid name, calls onAdd and clears input and error (4.1, 4.2)', async () => {
    const { onAdd, user, input, button } = setup();
    await user.click(button);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(input, '  遠端工作  ');
    await user.click(button);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('遠端工作');
    expect(input).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('accepts exactly 20 characters', async () => {
    const { onAdd, user, input, button } = setup();
    await user.type(input, '字'.repeat(20));
    await user.click(button);
    expect(onAdd).toHaveBeenCalledWith('字'.repeat(20));
  });

  it('submits on Enter without submitting an outer form', async () => {
    const onAdd = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <JobPreferenceReasonAddInput onAdd={onAdd} />
      </form>,
    );
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: '新增子分類' });
    await user.type(input, '薪水高{Enter}');
    expect(onAdd).toHaveBeenCalledWith('薪水高');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores Enter while an IME composition is in progress', () => {
    const { onAdd, input } = setup();
    fireEvent.change(input, { target: { value: '遠端' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onAdd).not.toHaveBeenCalled();
  });
});
