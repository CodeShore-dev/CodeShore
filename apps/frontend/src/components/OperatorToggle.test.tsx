import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OperatorToggle } from './OperatorToggle';

describe('OperatorToggle', () => {
  it('emits the new operator when a different option is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OperatorToggle value="and" onChange={onChange} />);

    await user.click(screen.getByText('OR'));

    expect(onChange).toHaveBeenCalledWith('or');
  });

  it('does not emit when the active option is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OperatorToggle value="and" onChange={onChange} />);

    await user.click(screen.getByText('AND'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
