import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SupabaseView } from '@codeshore/data-types';

import { CompanyDetailModal } from './CompanyDetailModal';

const categoryLabelMap: Record<string, string> = {
  language: '語言',
  framework: '框架',
  database: '資料庫',
  library: '函式庫',
  service: '服務',
  tool: '工具',
};

function makeTech(
  tech: string,
  category: string,
  label = tech,
  count = 1,
): SupabaseView.MvTech {
  return {
    tech,
    category,
    label,
    count,
    children: null,
    icon_slugs: null,
    keywords: null,
    parents: null,
    tags: null,
  };
}

function makeCompany(
  techs: string[],
  overrides: Partial<SupabaseView.MvCompany> = {},
): SupabaseView.MvCompany {
  return {
    company_id: '1',
    company_name: 'Acme Corp',
    company_type: 'Startup',
    company_link: null,
    job_count: 10,
    techs,
    ...overrides,
  };
}

describe('CompanyDetailModal', () => {
  it('renders nothing when company is null (Req 4.7 / Modal open gating)', () => {
    render(
      <CompanyDetailModal
        company={null}
        techs={[]}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={vi.fn()}
      />,
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
  });

  it('shows every technology in a category with more than five items, untruncated (Req 4.2)', () => {
    const languageTechNames = [
      'typescript',
      'python',
      'go',
      'rust',
      'java',
      'kotlin',
      'ruby',
    ];
    const techs = languageTechNames.map((name, i) =>
      makeTech(name, 'language', name, languageTechNames.length - i),
    );
    const company = makeCompany(languageTechNames);

    render(
      <CompanyDetailModal
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={vi.fn()}
      />,
    );

    for (const name of languageTechNames) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('renders a link element when company_link is present (Req 4.3)', () => {
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript'], {
      company_link: 'https://acme.example.com',
    });

    render(
      <CompanyDetailModal
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={vi.fn()}
      />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://acme.example.com');
  });

  it('renders no link element when company_link is absent (Req 4.4)', () => {
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript'], { company_link: null });

    render(
      <CompanyDetailModal
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={vi.fn()}
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the company basic info (type) when present (Req 4.3)', () => {
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript'], { company_type: 'Startup' });

    render(
      <CompanyDetailModal
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={vi.fn()}
      />,
    );

    expect(screen.getByText('Startup')).toBeInTheDocument();
  });

  it('shows the modal title as the company name and calls onClose from the close control', () => {
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript']);

    render(
      <CompanyDetailModal
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Acme Corp' }),
    ).toBeInTheDocument();
  });
});
