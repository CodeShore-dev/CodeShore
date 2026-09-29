import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HomeHandoff } from './HomeHandoff';

vi.mock('../../../hooks/useJobHostStatistics', () => ({
  useJobHostStatistics: () => ({
    percentFor: (host: string) => (host === '104.com.tw' ? 88 : 12),
  }),
}));

// 整張卡片可點（issue #23）：外層改成唯一的 <a>，箭頭純裝飾。
describe('HomeHandoff', () => {
  it('renders one link per channel and no more', () => {
    render(<HomeHandoff />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['https://104.com.tw', 'https://cake.me']);
  });

  it('keeps target=_blank and rel=noreferrer on every card', () => {
    render(<HomeHandoff />);

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  });

  it('puts the name, the host and the percent inside the link', () => {
    render(<HomeHandoff />);

    const link = screen.getByRole('link', { name: /104 人力銀行/ });
    expect(link).toContainElement(screen.getByText('104 人力銀行'));
    expect(link).toContainElement(screen.getByText(/104\.com\.tw · 88%/));
  });

  it('hides the arrow from the accessibility tree', () => {
    render(<HomeHandoff />);

    const arrows = screen.getAllByText('↗');
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) {
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('lets the keyboard reach both cards with Tab', async () => {
    const user = userEvent.setup();
    render(<HomeHandoff />);

    const [first, second] = screen.getAllByRole('link');

    await user.tab();
    expect(first).toHaveFocus();

    await user.tab();
    expect(second).toHaveFocus();
  });

  it('activates the focused card with Enter', async () => {
    const user = userEvent.setup();
    render(<HomeHandoff />);

    const link = screen.getByRole('link', { name: /104 人力銀行/ });
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    link.addEventListener('click', onClick as EventListener);

    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows a focus ring and a hover state on the whole card', () => {
    render(<HomeHandoff />);

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('focus-visible:ring-2');
      expect(link.className).toContain('hover:bg-white/20');
      expect(link.className).toContain('cursor-pointer');
    }
  });
});
