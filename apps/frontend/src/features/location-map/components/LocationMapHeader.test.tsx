import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { useTechsQuery } = vi.hoisted(() => ({ useTechsQuery: vi.fn() }));

vi.mock('../../keyword/queries', () => ({ useTechsQuery }));

import { LocationMapHeader } from './LocationMapHeader';

const TECHS = [{ tech: 'react', label: 'React', icon_slugs: null }];

describe('LocationMapHeader', () => {
  it('renders the page title', () => {
    useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
    render(<LocationMapHeader viewMode="jobCount" selectedTech={null} />);

    expect(screen.getByRole('heading', { name: '職缺地圖' })).toBeInTheDocument();
  });

  it('shows "職缺數" as the current subject in job-count view', () => {
    useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
    render(<LocationMapHeader viewMode="jobCount" selectedTech={null} />);

    expect(screen.getByText('目前檢視：職缺數')).toBeInTheDocument();
  });

  it('shows the selected technology\'s label (not its raw id) as the current subject in tech view', () => {
    useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
    render(<LocationMapHeader viewMode="tech" selectedTech="react" />);

    expect(screen.getByText('目前檢視：React')).toBeInTheDocument();
    expect(screen.queryByText('目前檢視：react')).not.toBeInTheDocument();
  });

  it('shows a placeholder subject in tech view before any technology is selected', () => {
    useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
    render(<LocationMapHeader viewMode="tech" selectedTech={null} />);

    expect(screen.getByText('目前檢視：技術（尚未選擇）')).toBeInTheDocument();
  });

  it('falls back to the raw tech id when no matching catalog entry is found', () => {
    useTechsQuery.mockReturnValue({ data: TECHS, isLoading: false });
    render(<LocationMapHeader viewMode="tech" selectedTech="unknown-tech" />);

    expect(screen.getByText('目前檢視：unknown-tech')).toBeInTheDocument();
  });
});
