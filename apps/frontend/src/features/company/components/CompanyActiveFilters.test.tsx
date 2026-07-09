import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({
    result: [
      {
        tech: 'react',
        label: 'React',
        category: '',
        count: 10,
        keywords: ['react'],
        icon_slugs: null,
        children: [],
        parents: [],
        tags: [],
      },
    ],
  }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

import { useCompanyFilterStore } from '../companyFilterStore';
import { useCompanyTechFilterStore } from '../companyTechFilterStore';
import { CompanyActiveFilters } from './CompanyActiveFilters';

describe('CompanyActiveFilters', () => {
  beforeEach(() => {
    useCompanyFilterStore.getState().clearFilters();
    useCompanyTechFilterStore.getState().reset();
  });

  it('renders nothing when there are no active filters', () => {
    const { container } = renderWithProviders(
      <CompanyActiveFilters onClearAll={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip per company filter and tech selection, colored by include/exclude', async () => {
    useCompanyFilterStore.setState({
      companyFilters: [
        { name: 'Acme Corp', mode: 'include' },
        { name: 'Globex', mode: 'exclude' },
      ],
    });
    useCompanyTechFilterStore.setState({
      selectedTags: ['react'],
      excludedTags: [],
    });

    renderWithProviders(<CompanyActiveFilters onClearAll={vi.fn()} />);

    const includeChipText = await screen.findByText('Acme Corp');
    const excludeChipText = await screen.findByText('Globex');
    const techChipText = await screen.findByText('React');

    expect(includeChipText.parentElement?.className).toContain(
      'bg-[#003d92]',
    );
    expect(excludeChipText.parentElement?.className).toContain(
      'bg-[#ba1a1a]',
    );
    expect(techChipText.parentElement?.className).toContain('bg-[#003d92]');
  });

  it('removes a company filter chip via its close button', async () => {
    const user = userEvent.setup();
    useCompanyFilterStore.setState({
      companyFilters: [{ name: 'Acme Corp', mode: 'include' }],
    });

    renderWithProviders(<CompanyActiveFilters onClearAll={vi.fn()} />);

    const chipText = await screen.findByText('Acme Corp');
    const chip = chipText.parentElement as HTMLElement;
    await user.click(chip.querySelector('button') as HTMLElement);

    expect(useCompanyFilterStore.getState().companyFilters).toEqual([]);
  });

  it('calls onClearAll when "清除全部" is clicked', async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    useCompanyFilterStore.setState({
      companyFilters: [{ name: 'Acme Corp', mode: 'include' }],
    });

    renderWithProviders(<CompanyActiveFilters onClearAll={onClearAll} />);

    await user.click(await screen.findByText('清除全部'));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
