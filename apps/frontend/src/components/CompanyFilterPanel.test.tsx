import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SupabaseView } from '@codeshore/data-types';

import type { CompanyFilterEntry } from './CompanyFilterChip';
import { CompanyFilterPanel, type CompanyFilterPanelProps } from './CompanyFilterPanel';

const ACME: SupabaseView.MvCompany = {
  company_id: '1',
  company_name: 'Acme Corp',
  company_type: null,
  company_link: null,
  job_count: 3,
  techs: [],
};

const BETA: SupabaseView.MvCompany = {
  company_id: '2',
  company_name: 'Beta Inc',
  company_type: null,
  company_link: null,
  job_count: 1,
  techs: [],
};

function buildProps(
  overrides: Partial<CompanyFilterPanelProps> = {},
): CompanyFilterPanelProps {
  return {
    entries: [],
    search: '',
    onSearchChange: vi.fn(),
    suggestions: [],
    isFetching: false,
    onSelect: vi.fn(),
    onToggleMode: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
}

describe('CompanyFilterPanel', () => {
  it('shows suggestions from props when focused with search text (Req 1.1)', () => {
    render(
      <CompanyFilterPanel
        {...buildProps({ search: 'a', suggestions: [ACME, BETA] })}
      />,
    );

    const input = screen.getByPlaceholderText('搜尋公司...');
    fireEvent.focus(input);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('does not show the suggestions dropdown when search text is empty', () => {
    render(
      <CompanyFilterPanel
        {...buildProps({ search: '', suggestions: [ACME] })}
      />,
    );

    const input = screen.getByPlaceholderText('搜尋公司...');
    fireEvent.focus(input);

    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('shows a loading state while isFetching is true', () => {
    render(
      <CompanyFilterPanel
        {...buildProps({ search: 'a', isFetching: true, suggestions: [] })}
      />,
    );

    const input = screen.getByPlaceholderText('搜尋公司...');
    fireEvent.focus(input);

    expect(screen.getByText('搜尋中...')).toBeInTheDocument();
  });

  it('shows an empty state when not fetching and there are no suggestions', () => {
    render(
      <CompanyFilterPanel
        {...buildProps({ search: 'zzz', isFetching: false, suggestions: [] })}
      />,
    );

    const input = screen.getByPlaceholderText('搜尋公司...');
    fireEvent.focus(input);

    expect(screen.getByText('沒有符合的公司')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in the search box', () => {
    const onSearchChange = vi.fn();
    render(
      <CompanyFilterPanel {...buildProps({ onSearchChange })} />,
    );

    const input = screen.getByPlaceholderText('搜尋公司...');
    fireEvent.change(input, { target: { value: 'acme' } });

    expect(onSearchChange).toHaveBeenCalledWith('acme');
  });

  it('calls onSelect with the company name when a suggestion is chosen (Req 1.2)', () => {
    const onSelect = vi.fn();
    render(
      <CompanyFilterPanel
        {...buildProps({ search: 'a', suggestions: [ACME], onSelect })}
      />,
    );

    const input = screen.getByPlaceholderText('搜尋公司...');
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText('Acme Corp'));

    expect(onSelect).toHaveBeenCalledWith('Acme Corp');
  });

  it('renders one CompanyFilterChip per entry, styled by mode (Req 1.3, 1.4)', () => {
    const entries: CompanyFilterEntry[] = [
      { name: 'Acme Corp', mode: 'include' },
      { name: 'Beta Inc', mode: 'exclude' },
    ];
    render(<CompanyFilterPanel {...buildProps({ entries })} />);

    const includeChip = screen.getByText('Acme Corp').parentElement;
    expect(includeChip?.className).toContain('bg-[#003d92]');

    const excludeChip = screen.getByText('Beta Inc').parentElement;
    expect(excludeChip?.className).toContain('bg-[#ba1a1a]');
  });

  it('calls onToggleMode with the entry name when its chip toggle is clicked', async () => {
    const onToggleMode = vi.fn();
    const entries: CompanyFilterEntry[] = [
      { name: 'Acme Corp', mode: 'include' },
    ];
    const user = userEvent.setup();
    render(<CompanyFilterPanel {...buildProps({ entries, onToggleMode })} />);

    await user.click(screen.getByTitle(/切換為排除/));

    expect(onToggleMode).toHaveBeenCalledWith('Acme Corp');
  });

  it('calls onRemove with the entry name when its chip remove control is clicked', async () => {
    const onRemove = vi.fn();
    const entries: CompanyFilterEntry[] = [
      { name: 'Acme Corp', mode: 'include' },
    ];
    const user = userEvent.setup();
    render(<CompanyFilterPanel {...buildProps({ entries, onRemove })} />);

    await user.click(screen.getByTitle(/移除/));

    expect(onRemove).toHaveBeenCalledWith('Acme Corp');
  });

  it('uses a custom searchPlaceholder when provided', () => {
    render(
      <CompanyFilterPanel
        {...buildProps({ searchPlaceholder: '搜尋公司名稱...' })}
      />,
    );

    expect(screen.getByPlaceholderText('搜尋公司名稱...')).toBeInTheDocument();
  });
});
