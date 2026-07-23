import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useTechsQuery } = vi.hoisted(() => ({
  useTechsQuery: vi.fn(),
}));

// `ViewModeToggle` reuses the shared technology catalog exactly as
// `CompanyListPage.tsx` does (`useTechsQuery` from `../../keyword/queries`),
// so this spec mocks at that same boundary rather than inventing a new
// tech-fetching mechanism (task 7.1 boundary).
vi.mock('../../keyword/queries', () => ({
  useTechsQuery,
}));

import { useLocationMapStore } from '../locationMapStore';
import { ViewModeToggle } from './ViewModeToggle';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const TECHS = [
  { tech: 'react', label: 'React', icon_slugs: null, count: 10 },
  { tech: 'vue', label: 'Vue', icon_slugs: null, count: 5 },
];

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
});

describe('ViewModeToggle', () => {
  it('renders the 職缺數／技術 tabs, defaulting to 職缺數 (jobCount)', () => {
    render(<ViewModeToggle />, { wrapper });

    expect(screen.getByRole('tab', { name: '職缺數' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '技術' })).toBeInTheDocument();
    expect(useLocationMapStore.getState().viewMode).toBe('jobCount');
  });

  it('clicking the 技術 tab switches locationMapStore.viewMode to "tech"', () => {
    render(<ViewModeToggle />, { wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '技術' }));

    expect(useLocationMapStore.getState().viewMode).toBe('tech');
  });

  it('clicking the 職缺數 tab switches locationMapStore.viewMode back to "jobCount"', () => {
    useLocationMapStore.getState().setViewMode('tech');
    render(<ViewModeToggle />, { wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '職缺數' }));

    expect(useLocationMapStore.getState().viewMode).toBe('jobCount');
  });

  it('does not render the technology search/select menu while in 職缺數 view', () => {
    render(<ViewModeToggle />, { wrapper });

    expect(screen.queryByPlaceholderText('搜尋技術...')).not.toBeInTheDocument();
    expect(screen.queryByText('請選擇一個技術')).not.toBeInTheDocument();
  });

  it('switching to 技術 view with no selectedTech shows the guidance prompt and does NOT auto-select the first tech (Requirement 4.3)', () => {
    render(<ViewModeToggle />, { wrapper });

    fireEvent.click(screen.getByRole('tab', { name: '技術' }));

    expect(screen.getByText('請選擇一個技術')).toBeInTheDocument();
    expect(useLocationMapStore.getState().selectedTech).toBeNull();
    // The full tech list is still shown for the user to pick from.
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
  });

  it('selecting a tech from the list updates locationMapStore.selectedTech and the prompt disappears', () => {
    useLocationMapStore.getState().setViewMode('tech');
    render(<ViewModeToggle />, { wrapper });

    expect(screen.getByText('請選擇一個技術')).toBeInTheDocument();

    fireEvent.click(screen.getByText('React'));

    expect(useLocationMapStore.getState().selectedTech).toBe('react');
    expect(screen.queryByText('請選擇一個技術')).not.toBeInTheDocument();
  });

  it('filters the tech list by the search box', () => {
    useLocationMapStore.getState().setViewMode('tech');
    render(<ViewModeToggle />, { wrapper });

    fireEvent.change(screen.getByPlaceholderText('搜尋技術...'), {
      target: { value: 'vue' },
    });

    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  it('renders the currently selected tech as visually active among the list', () => {
    useLocationMapStore.getState().setViewMode('tech');
    useLocationMapStore.getState().setSelectedTech('vue');
    render(<ViewModeToggle />, { wrapper });

    const selectedRow = screen.getByText('Vue').closest('[data-tech]');
    expect(selectedRow).toHaveAttribute('data-selected', 'true');
    const unselectedRow = screen.getByText('React').closest('[data-tech]');
    expect(unselectedRow).toHaveAttribute('data-selected', 'false');
  });
});
