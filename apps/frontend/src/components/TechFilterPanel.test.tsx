import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SupabaseView } from '@codeshore/data-types';

import type { TechCatalogView } from '../features/keyword/useKeywordCatalogView';
import { TechFilterPanel } from './TechFilterPanel';

const REACT_TECH: SupabaseView.MvTech = {
  tech: 'react',
  label: 'React',
  category: 'framework',
  count: 10,
  keywords: ['react'],
  icon_slugs: ['simple-icons:react'],
  children: [],
  parents: ['javascript'],
  tags: [],
};

const JAVASCRIPT_TECH: SupabaseView.MvTech = {
  tech: 'javascript',
  label: 'JavaScript',
  category: 'language',
  count: 20,
  keywords: ['javascript'],
  icon_slugs: ['simple-icons:javascript'],
  children: [],
  parents: [],
  tags: [],
};

const SOME_FRAMEWORK_TECH: SupabaseView.MvTech = {
  tech: 'some-framework',
  label: 'Some Framework',
  category: 'framework',
  count: 5,
  keywords: ['some-framework'],
  icon_slugs: null,
  children: [],
  parents: ['unknown-parent-id'],
  tags: [],
};

function buildProps(overrides: Partial<TechCatalogView> = {}): TechCatalogView {
  const techs = [REACT_TECH, JAVASCRIPT_TECH, SOME_FRAMEWORK_TECH];
  return {
    techs,
    visibleTabs: [
      { label: '語言', value: 'language', count: 1, tooltip: '語言 · 1 個技術' },
      { label: '框架', value: 'framework', count: 2, tooltip: '框架 · 2 個技術' },
    ],
    selectedTab: 'framework',
    setSelectedTab: vi.fn(),
    keywordSearch: '',
    setKeywordSearch: vi.fn(),
    categoriesWithSelections: new Set<string>(),
    filteredTechView: [REACT_TECH, SOME_FRAMEWORK_TECH],
    selectedTags: [],
    excludedTags: [],
    keywordOperator: 'and',
    setOperator: vi.fn(),
    toggleTech: vi.fn(),
    ...overrides,
  };
}

describe('TechFilterPanel', () => {
  it('renders the tech list with icon, label, and job count from props', () => {
    render(<TechFilterPanel {...buildProps()} />);

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Some Framework')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders category tabs from visibleTabs', () => {
    render(<TechFilterPanel {...buildProps()} />);

    expect(screen.getByText('語言')).toBeInTheDocument();
    expect(screen.getByText('框架')).toBeInTheDocument();
  });

  it('resolves a parent id to its catalog label via techByTech built from props.techs', () => {
    render(<TechFilterPanel {...buildProps()} />);

    // "react" has parent id "javascript", which has a matching catalog
    // record with label "JavaScript".
    const parentChips = document.querySelectorAll(
      '.rounded-full.border.border-current\\/30',
    );
    const parentChipTexts = Array.from(parentChips).map(el => el.textContent);
    expect(parentChipTexts).toContain('JavaScript');
    expect(parentChipTexts).not.toContain('javascript');
  });

  it('falls back to the raw parent id string when no catalog record matches', () => {
    render(<TechFilterPanel {...buildProps()} />);

    expect(screen.getByText('unknown-parent-id')).toBeInTheDocument();
  });

  it('calls toggleTech with the tech id when a tech item is clicked', async () => {
    const toggleTech = vi.fn();
    const user = userEvent.setup();
    render(<TechFilterPanel {...buildProps({ toggleTech })} />);

    await user.click(screen.getByText('React'));

    expect(toggleTech).toHaveBeenCalledWith('react');
  });

  it('does not render the AND/OR toggle when 1 or fewer techs are selected', () => {
    render(<TechFilterPanel {...buildProps({ selectedTags: ['react'] })} />);

    expect(screen.queryByText('AND')).not.toBeInTheDocument();
    expect(screen.queryByText('OR')).not.toBeInTheDocument();
  });

  it('renders the AND/OR toggle when more than 1 tech is selected', () => {
    render(
      <TechFilterPanel
        {...buildProps({ selectedTags: ['react', 'some-framework'] })}
      />,
    );

    expect(screen.getByText('AND')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('calls setKeywordSearch when typing in the search box, using the default placeholder', () => {
    const setKeywordSearch = vi.fn();
    render(<TechFilterPanel {...buildProps({ setKeywordSearch })} />);

    const input = screen.getByPlaceholderText('搜尋技能...');
    expect(input).toBeInTheDocument();
  });

  it('uses a custom searchPlaceholder when provided', () => {
    render(
      <TechFilterPanel {...buildProps()} searchPlaceholder="搜尋技術..." />,
    );

    expect(screen.getByPlaceholderText('搜尋技術...')).toBeInTheDocument();
  });

  it('applies selected/excluded styling to tech items', () => {
    render(
      <TechFilterPanel
        {...buildProps({
          selectedTags: ['react'],
          excludedTags: ['some-framework'],
        })}
      />,
    );

    const reactItem = screen.getByText('React').closest('span.flex.w-full');
    expect(reactItem?.className).toContain('bg-primary');

    const excludedItem = screen
      .getByText('Some Framework')
      .closest('span.flex.w-full');
    expect(excludedItem?.className).toContain('bg-error');
  });
});
