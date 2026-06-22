import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('calls onChange as the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput value="" placeholder="搜尋職缺" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('搜尋職缺'), 'go');

    expect(onChange).toHaveBeenCalled();
  });

  it('clears the value via the clear button', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SearchInput value="abc" onChange={onChange} />);

    await user.click(screen.getByRole('button'));

    expect(onChange).toHaveBeenCalledWith('');
  });
});
