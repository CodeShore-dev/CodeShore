import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
        icon_slugs: ['simple-icons:react'],
        children: [],
        parents: ['javascript'],
        tags: [],
      },
      {
        tech: 'javascript',
        label: 'JavaScript',
        category: '',
        count: 20,
        keywords: ['javascript'],
        icon_slugs: ['simple-icons:javascript'],
        children: [],
        parents: [],
        tags: [],
      },
    ],
  }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useCompanyTechFilterStore } from '../companyTechFilterStore';
import { CompanyTechFilterPanel } from './CompanyTechFilterPanel';

describe('CompanyTechFilterPanel', () => {
  afterEach(() => {
    useCompanyTechFilterStore.getState().reset();
    useKeywordFilterStore.getState().reset();
  });

  it('renders the shared TechFilterPanel with icon, label, and job count', async () => {
    renderWithProviders(<CompanyTechFilterPanel />);

    expect(await screen.findByText('React')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('resolves a parent id to its resolved catalog label', async () => {
    renderWithProviders(<CompanyTechFilterPanel />);

    await screen.findByText('React');

    const parentChips = document.querySelectorAll(
      '.rounded-full.border.border-current\\/30',
    );
    const parentChipTexts = Array.from(parentChips).map(el => el.textContent);
    expect(parentChipTexts).toContain('JavaScript');
  });

  it('selecting a tech updates useCompanyTechFilterStore only, leaving useKeywordFilterStore untouched', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyTechFilterPanel />);

    await user.click(await screen.findByText('React'));

    expect(useCompanyTechFilterStore.getState().selectedTags).toEqual([
      'react',
    ]);
    expect(useKeywordFilterStore.getState().selectedTags).toEqual([]);
  });
});
