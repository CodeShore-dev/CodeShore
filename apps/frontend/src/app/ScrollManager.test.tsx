import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScrollManager } from './ScrollManager';

function Nav() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/b')}>
        go b
      </button>
      <button type="button" onClick={() => navigate('/a?x=1')}>
        query a
      </button>
    </>
  );
}

let scrollSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  scrollSpy = vi
    .spyOn(window, 'scrollTo')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  scrollSpy.mockRestore();
});

function renderManager() {
  return render(
    <MemoryRouter initialEntries={['/a']}>
      <ScrollManager />
      <Nav />
      <Routes>
        <Route path="/a" element={<div>page A</div>} />
        <Route path="/b" element={<div>page B</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScrollManager', () => {
  it('scrolls to top on a path change (req 9.1)', async () => {
    const user = userEvent.setup();
    renderManager();
    scrollSpy.mockClear(); // ignore initial-mount scroll

    await user.click(screen.getByText('go b'));

    expect(screen.getByText('page B')).toBeInTheDocument();
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
  });

  it('does not scroll on a same-path query-only change (req 9.3)', async () => {
    const user = userEvent.setup();
    renderManager();
    scrollSpy.mockClear();

    await user.click(screen.getByText('query a'));

    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
