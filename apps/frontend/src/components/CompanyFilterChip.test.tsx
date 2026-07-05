import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CompanyFilterChip, type CompanyFilterEntry } from './CompanyFilterChip';

describe('CompanyFilterChip', () => {
  it('renders include-mode entries with the include (blue) style', () => {
    const entry: CompanyFilterEntry = { name: 'Acme Corp', mode: 'include' };
    render(
      <CompanyFilterChip entry={entry} onToggleMode={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    const chip = screen.getByText('Acme Corp').parentElement;
    expect(chip?.className).toContain('bg-[#003d92]');
  });

  it('renders exclude-mode entries with the exclude (red) style', () => {
    const entry: CompanyFilterEntry = { name: 'Beta Inc', mode: 'exclude' };
    render(
      <CompanyFilterChip entry={entry} onToggleMode={vi.fn()} onRemove={vi.fn()} />,
    );

    const chip = screen.getByText('Beta Inc').parentElement;
    expect(chip?.className).toContain('bg-[#ba1a1a]');
  });

  it('calls onToggleMode when the toggle control is clicked', async () => {
    const onToggleMode = vi.fn();
    const entry: CompanyFilterEntry = { name: 'Acme Corp', mode: 'include' };
    const user = userEvent.setup();
    render(
      <CompanyFilterChip
        entry={entry}
        onToggleMode={onToggleMode}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle(/切換為排除/));

    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when the remove control is clicked', async () => {
    const onRemove = vi.fn();
    const entry: CompanyFilterEntry = { name: 'Acme Corp', mode: 'include' };
    const user = userEvent.setup();
    render(
      <CompanyFilterChip entry={entry} onToggleMode={vi.fn()} onRemove={onRemove} />,
    );

    await user.click(screen.getByTitle(/移除/));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows a "switch to include" title when the entry is already excluded', () => {
    const entry: CompanyFilterEntry = { name: 'Beta Inc', mode: 'exclude' };
    render(
      <CompanyFilterChip entry={entry} onToggleMode={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByTitle(/切換為包含/)).toBeInTheDocument();
  });
});
