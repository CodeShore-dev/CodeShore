import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SupabaseView } from '@codeshore/data-types';

import { CompanyCard } from './CompanyCard';

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

describe('CompanyCard', () => {
  it('shows a count badge for each category the company has technologies in (Req 3.1, 3.2, 3.3)', () => {
    const techs = [
      makeTech('typescript', 'language'),
      makeTech('python', 'language'),
      makeTech('react', 'framework'),
      makeTech('postgres', 'database'),
    ];
    const company = makeCompany(['typescript', 'python', 'react', 'postgres']);

    render(
      <CompanyCard
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/語言/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/框架/)).toBeInTheDocument();
    expect(screen.getByText(/資料庫/)).toBeInTheDocument();
  });

  it('does not render an individual technology name chip (Req 3.5)', () => {
    const techs = [
      makeTech('typescript', 'language', 'TypeScript'),
      makeTech('react', 'framework', 'React'),
      makeTech('postgres', 'database', 'PostgreSQL'),
    ];
    const company = makeCompany(['typescript', 'react', 'postgres']);

    render(
      <CompanyCard
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClick={vi.fn()}
      />,
    );

    expect(screen.queryByText('TypeScript')).not.toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
    expect(screen.queryByText('PostgreSQL')).not.toBeInTheDocument();
  });

  it('does not show a badge for a category the company has no technologies in (Req 3.4)', () => {
    const techs = [
      makeTech('typescript', 'language'),
      makeTech('react', 'framework'),
      makeTech('postgres', 'database'),
      makeTech('docker', 'tool'),
    ];
    // Company only has language + framework + database techs, no "tool" tech.
    const company = makeCompany(['typescript', 'react', 'postgres']);

    render(
      <CompanyCard
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClick={vi.fn()}
      />,
    );

    expect(screen.queryByText(/工具/)).not.toBeInTheDocument();
  });
});
