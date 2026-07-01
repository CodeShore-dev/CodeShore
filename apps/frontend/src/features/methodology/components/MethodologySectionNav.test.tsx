import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MethodologySectionNav } from './MethodologySectionNav';

const items = [
  { id: 'alpha', title: 'Alpha 區塊' },
  { id: 'beta', title: 'Beta 區塊' },
];

describe('MethodologySectionNav', () => {
  it('renders an anchor link per item, pointing at its section hash', () => {
    render(
      <MemoryRouter>
        <MethodologySectionNav items={items} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('link', { name: 'Alpha 區塊' }).length).toBeGreaterThan(0);
    const [link] = screen.getAllByRole('link', { name: 'Beta 區塊' });
    expect(link).toHaveAttribute('href', '/#beta');
  });

  it('renders nothing when given no items', () => {
    const { container } = render(
      <MemoryRouter>
        <MethodologySectionNav items={[]} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the mobile sheet on FAB tap and lists every section', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MethodologySectionNav items={items} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog', { name: '本頁區塊導覽' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '切換頁面區塊' }));

    const sheet = screen.getByRole('dialog', { name: '本頁區塊導覽' });
    expect(within(sheet).getByRole('link', { name: 'Alpha 區塊' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Beta 區塊' })).toBeInTheDocument();
  });

  it('closes the mobile sheet after choosing a section', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MethodologySectionNav items={items} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '切換頁面區塊' }));
    const sheet = screen.getByRole('dialog', { name: '本頁區塊導覽' });
    await user.click(within(sheet).getByRole('link', { name: 'Alpha 區塊' }));

    expect(screen.queryByRole('dialog', { name: '本頁區塊導覽' })).not.toBeInTheDocument();
  });

  it('closes the mobile sheet when clicking outside of it', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <div>
          <button type="button">outside</button>
          <MethodologySectionNav items={items} />
        </div>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '切換頁面區塊' }));
    expect(screen.getByRole('dialog', { name: '本頁區塊導覽' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('dialog', { name: '本頁區塊導覽' })).not.toBeInTheDocument();
  });
});
