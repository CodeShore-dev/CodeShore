import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { NavLink } from './hooks/useNavLinks';
import { MoreNavMenu } from './MoreNavMenu';

const links: NavLink[] = [
  { to: '/keywords', label: '關鍵字', icon: 'label', exact: false },
  { to: '/admin/jobs', label: '監控', icon: 'monitoring', exact: false },
];

function renderMenu(
  overrideLinks: NavLink[] = links,
  variant: 'desktop' | 'mobile' = 'desktop',
) {
  return render(
    <MemoryRouter>
      <MoreNavMenu
        links={overrideLinks}
        isActive={() => false}
        variant={variant}
      />
    </MemoryRouter>,
  );
}

describe('MoreNavMenu', () => {
  it('renders nothing when links is empty (non-admin)', () => {
    const { container } = renderMenu([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the "更多" trigger for the desktop variant', () => {
    renderMenu(links, 'desktop');
    expect(screen.getByText('更多')).toBeInTheDocument();
  });

  it('opens the dropdown listing every link on click, closed by default', async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.queryByText('關鍵字')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('關鍵字')).toBeInTheDocument();
    expect(screen.getByText('監控')).toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <div>
          <MoreNavMenu links={links} isActive={() => false} variant="desktop" />
          <button type="button">outside</button>
        </div>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /更多/ }));
    expect(screen.getByText('關鍵字')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByText('關鍵字')).not.toBeInTheDocument();
  });

  it('closes the dropdown after clicking a link', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('關鍵字'));

    expect(screen.queryByText('關鍵字')).not.toBeInTheDocument();
  });

  it('highlights the trigger when any contained link is active', () => {
    render(
      <MemoryRouter>
        <MoreNavMenu links={links} isActive={l => l.to === '/keywords'} variant="desktop" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button')).toHaveClass('text-[#003d92]');
  });

  it('renders an icon-only trigger for the mobile variant', () => {
    renderMenu(links, 'mobile');
    expect(screen.getByText('more_horiz')).toBeInTheDocument();
    expect(screen.queryByText('更多')).not.toBeInTheDocument();
  });
});
