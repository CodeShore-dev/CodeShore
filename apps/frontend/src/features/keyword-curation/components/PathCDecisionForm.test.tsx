import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PathCDecisionForm } from './PathCDecisionForm';

// PathCDecisionForm (task 6.5, requirements 4.1, 4.4, 7.1): the human
// decision gate for path C (put keyword into keyword_bin as noise). Shows a
// confirmation message that the keyword will be excluded from all future
// curation candidates, and lets the admin either confirm (submits
// { path: 'C' }) or cancel (returns to path selection without triggering
// resume -- requirement 4.4).
describe('PathCDecisionForm', () => {
  it('renders the confirmation message explaining the keyword will be excluded from future curation candidates (requirement 7.1)', () => {
    render(<PathCDecisionForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(
      screen.getByText(/排除於未來所有工作流候選/),
    ).toBeInTheDocument();
  });

  it('submits { path: "C" } when the admin confirms', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<PathCDecisionForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '確認放入 Keyword Bin' }));

    expect(onSubmit).toHaveBeenCalledWith({ path: 'C' });
  });

  it('calls onCancel and does not call onSubmit when the admin cancels (requirement 4.4)', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<PathCDecisionForm onSubmit={onSubmit} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
