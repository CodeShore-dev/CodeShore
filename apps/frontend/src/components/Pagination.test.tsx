import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';

let scrollSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  scrollSpy = vi
    .spyOn(window, 'scrollTo')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  scrollSpy.mockRestore();
});

describe('Pagination', () => {
  it('renders nothing for a single page (req 6.3)', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('emits the chosen page and scrolls to top (req 6.3, 9.4)', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByText('3'));

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
  });

  it('disables the previous control on the first page', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />,
    );
    expect(screen.getAllByRole('button')[0]).toBeDisabled();
  });
});
