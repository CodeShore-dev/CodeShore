import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

const { company } = vi.hoisted(() => ({
  company: {
    company_id: 'c1',
    company_name: 'Acme Corp',
    company_type: '',
    job_count: 5,
    techs: [],
    company_link: '',
  },
}));

vi.mock('../service', () => ({
  fetchCompanies: vi
    .fn()
    .mockResolvedValue({ result: [company], count: 1 }),
  fetchCompanyTechStats: vi.fn().mockResolvedValue({ result: [] }),
}));
vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: [] }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
}));

import { useCompanyFilterStore } from '../companyFilterStore';
import { useCompanyTechFilterStore } from '../companyTechFilterStore';
import { CompanyListPage } from './CompanyListPage';

describe('CompanyListPage SEO (req 2.1, 2.2, 2.3, 3.1, 3.2, 5.3)', () => {
  beforeEach(() => {
    useCompanyFilterStore.getState().clearFilters();
    useCompanyTechFilterStore.getState().reset();
  });

  it('sets the document title with the site suffix (req 2.1)', () => {
    renderWithProviders(<CompanyListPage />, { route: '/companies' });
    expect(document.title).toBe('公司技術棧分析 | 碼的 上岸了');
  });

  it('renders a BreadcrumbList JSON-LD pointing at home and the company list page (req 5.3)', () => {
    const { container } = renderWithProviders(<CompanyListPage />, {
      route: '/companies',
    });
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();

    const parsed = JSON.parse(script?.innerHTML ?? '');
    expect(parsed).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首頁',
          item: 'https://codeshore.dev/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '公司列表',
          item: 'https://codeshore.dev/companies',
        },
      ],
    });
  });
});

describe('CompanyListPage', () => {
  beforeEach(() => {
    useCompanyFilterStore.getState().clearFilters();
    useCompanyTechFilterStore.getState().reset();
  });

  it('renders companies after load (req 6.1, 6.2)', async () => {
    renderWithProviders(<CompanyListPage />);
    expect(
      screen.getByText('● 公司列表 · COMPANIES'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders exactly one company-name filter block and one technology filter block (req 1.1, 2.1)', async () => {
    renderWithProviders(<CompanyListPage />);
    await screen.findByText('Acme Corp');

    expect(screen.getAllByPlaceholderText('搜尋公司...')).toHaveLength(1);
    expect(screen.getAllByPlaceholderText('搜尋技術...')).toHaveLength(1);

    // The old free-text company search input and technology accordion panel
    // must be gone entirely.
    expect(
      screen.queryByPlaceholderText('搜尋公司名稱'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('技術類別')).not.toBeInTheDocument();
  });

  it('supports selecting a company from the filter dropdown and toggling it to exclude (req 1.1, 1.2, 1.3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyListPage />);
    await screen.findByText('Acme Corp');

    const searchInput = screen.getByPlaceholderText('搜尋公司...');
    await user.type(searchInput, 'Acme');
    await user.click(await screen.findByText('Acme Corp', { selector: 'li' }));

    expect(useCompanyFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'include' },
    ]);

    const toggleButton = screen.getByTitle('切換為排除：Acme Corp');
    await user.click(toggleButton);

    expect(useCompanyFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme Corp', mode: 'exclude' },
    ]);
  });

  it('opens the company detail view from a card and closes it (req 4.1, 4.7)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyListPage />);

    await user.click(await screen.findByText('Acme Corp'));

    const modal = await screen.findByTestId('modal-backdrop');
    expect(
      within(modal).getByRole('heading', { name: 'Acme Corp' }),
    ).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: '關閉' }));

    await waitFor(() => {
      expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
    });
  });
});
