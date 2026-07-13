import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { UserMenu } from './UserMenu';

function renderMenu(email = 'user@example.com', onLogout = vi.fn()) {
  return {
    onLogout,
    ...render(
      <MemoryRouter>
        <UserMenu email={email} onLogout={onLogout} />
      </MemoryRouter>,
    ),
  };
}

describe('UserMenu', () => {
  it('does not show the panel by default, and opens it when the trigger is clicked', async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('closes the panel when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <div>
          <UserMenu email="user@example.com" onLogout={vi.fn()} />
          <button type="button">outside</button>
        </div>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /user@example.com/ }));
    expect(screen.getByText('user@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();
  });

  it('shows the passed email in the open panel', async () => {
    const user = userEvent.setup();
    renderMenu('someone@codeshore.dev');

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('someone@codeshore.dev')).toBeInTheDocument();
  });

  it('has a link to the watchlist page', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('link', { name: /關注/ })).toHaveAttribute(
      'href',
      '/jobs/watchlist',
    );
  });

  it('has a link to the existing liked/disliked job list view', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button'));

    const links = screen.getAllByRole('link');
    const likeLink = links.find(
      link => link.getAttribute('href') === '/jobs?tab=like',
    );
    expect(likeLink).toBeDefined();
  });

  it('calls onLogout and closes the panel when the logout item is clicked', async () => {
    const user = userEvent.setup();
    const { onLogout } = renderMenu();

    await user.click(screen.getByRole('button', { name: /user@example.com/ }));
    await user.click(screen.getByRole('button', { name: /登出/ }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('user@example.com')).not.toBeInTheDocument();
  });
});
