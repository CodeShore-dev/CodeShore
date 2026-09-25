import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { JobPreferenceReasonAddInput } from './JobPreferenceReasonAddInput';

type Props = Parameters<typeof JobPreferenceReasonAddInput>[0];

function setup(props: Partial<Props> = {}) {
  const all = { value: '', error: null, onChange: vi.fn(), onSubmit: vi.fn(), ...props };
  render(<JobPreferenceReasonAddInput {...all} />);
  return { ...all, user: userEvent.setup(), input: screen.getByRole('textbox', { name: '新增子分類' }) };
}

describe('JobPreferenceReasonAddInput', () => {
  it('has no own add button', () => {
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reports typed text through onChange', async () => {
    const { user, input, onChange } = setup();
    await user.type(input, '薪');
    expect(onChange).toHaveBeenCalledWith('薪');
  });

  it('shows the empty-name hint (4.3)', () => {
    setup({ error: 'empty' });
    expect(screen.getByRole('alert')).toHaveTextContent('請輸入名稱');
  });

  it('shows the too-long hint (4.4)', () => {
    setup({ error: 'too_long' });
    expect(screen.getByRole('alert')).toHaveTextContent('最多 20 個字');
  });

  it('submits on Enter without submitting an outer form', async () => {
    const onSubmit = vi.fn();
    const onFormSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onFormSubmit}>
        <JobPreferenceReasonAddInput value="薪水高" error={null} onChange={vi.fn()} onSubmit={onSubmit} />
      </form>,
    );
    await userEvent.setup().type(screen.getByRole('textbox', { name: '新增子分類' }), '{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it('ignores Enter while an IME composition is in progress', () => {
    const { input, onSubmit } = setup({ value: '遠端' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
