import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('shows a category label with its technology chips, most popular first', () => {
    const techs = [
      makeTech('typescript', 'language', 'TypeScript', 5),
      makeTech('python', 'language', 'Python', 10),
      makeTech('react', 'framework', 'React'),
      makeTech('postgres', 'database', 'PostgreSQL'),
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
    expect(screen.getByText(/框架/)).toBeInTheDocument();
    expect(screen.getByText(/資料庫/)).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
  });

  it('shows only the top 5 technologies per category and a +N overflow for the rest', () => {
    const techs = [
      makeTech('lang1', 'language', 'Lang1', 6),
      makeTech('lang2', 'language', 'Lang2', 5),
      makeTech('lang3', 'language', 'Lang3', 4),
      makeTech('lang4', 'language', 'Lang4', 3),
      makeTech('lang5', 'language', 'Lang5', 2),
      makeTech('lang6', 'language', 'Lang6', 1),
    ];
    const company = makeCompany([
      'lang1',
      'lang2',
      'lang3',
      'lang4',
      'lang5',
      'lang6',
    ]);

    render(
      <CompanyCard
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Lang1')).toBeInTheDocument();
    expect(screen.getByText('Lang5')).toBeInTheDocument();
    expect(screen.queryByText('Lang6')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('does not show a category label for a category the company has no technologies in (Req 3.4)', () => {
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

  it('opens the detail view via the dedicated action without triggering the card click-through (Req 4.1)', async () => {
    const user = userEvent.setup();
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript']);
    const onClick = vi.fn();
    const onOpenDetail = vi.fn();

    render(
      <CompanyCard
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClick={onClick}
        onOpenDetail={onOpenDetail}
      />,
    );

    await user.click(screen.getByRole('button', { name: /詳情|detail/i }));

    expect(onOpenDetail).toHaveBeenCalledWith(company);
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('still navigates to the jobs list when clicking elsewhere on the card (regression)', async () => {
    const user = userEvent.setup();
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript']);
    const onClick = vi.fn();
    const onOpenDetail = vi.fn();

    render(
      <CompanyCard
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClick={onClick}
        onOpenDetail={onOpenDetail}
      />,
    );

    await user.click(screen.getByText('Acme Corp'));

    expect(onClick).toHaveBeenCalledWith('Acme Corp');
    expect(onOpenDetail).not.toHaveBeenCalled();
  });
});
