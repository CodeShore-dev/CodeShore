import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupabaseView } from '@codeshore/data-types';

const { useCompanyTechStatsQuery } = vi.hoisted(() => ({
  useCompanyTechStatsQuery: vi.fn(),
}));

vi.mock('../queries', () => ({ useCompanyTechStatsQuery }));

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

function makeTechStat(
  tech: string,
  job_count: number,
): SupabaseView.MvCompanyTech {
  return { company_id: '1', tech, job_count };
}

describe('CompanyDetailModal', () => {
  beforeEach(() => {
    useCompanyTechStatsQuery.mockReset();
    useCompanyTechStatsQuery.mockReturnValue({ data: [] });
  });

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

  it('calls onGoToJobs with the open company\'s name when the jobs-list shortcut is clicked (Req 4.5 / 4.6)', async () => {
    const user = userEvent.setup();
    const onGoToJobs = vi.fn();
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript'], {
      company_name: 'Acme Corp',
    });

    render(
      <CompanyDetailModal
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={onGoToJobs}
      />,
    );

    await user.click(screen.getByRole('button', { name: '查看職缺 →' }));

    expect(onGoToJobs).toHaveBeenCalledTimes(1);
    expect(onGoToJobs).toHaveBeenCalledWith('Acme Corp');
  });

  it('shows each technology with its job count and percentage of the company total, in the given (already-sorted) order (Req 5.1, 5.2, 5.4)', () => {
    useCompanyTechStatsQuery.mockReturnValue({
      data: [
        makeTechStat('typescript', 8),
        makeTechStat('python', 5),
        makeTechStat('go', 2),
      ],
    });
    const techs = [
      makeTech('typescript', 'language'),
      makeTech('python', 'language'),
      makeTech('go', 'language'),
    ];
    const company = makeCompany(['typescript', 'python', 'go'], {
      job_count: 10,
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

    expect(useCompanyTechStatsQuery).toHaveBeenCalledWith('1');

    const rows = screen.getAllByTestId('tech-stat-row');
    expect(rows).toHaveLength(3);

    // Order preserved exactly as returned (backend already sorts desc).
    expect(rows[0]).toHaveTextContent('typescript');
    expect(rows[0]).toHaveTextContent('8');
    expect(rows[0]).toHaveTextContent('80%');

    expect(rows[1]).toHaveTextContent('python');
    expect(rows[1]).toHaveTextContent('5');
    expect(rows[1]).toHaveTextContent('50%');

    expect(rows[2]).toHaveTextContent('go');
    expect(rows[2]).toHaveTextContent('2');
    expect(rows[2]).toHaveTextContent('20%');
  });

  it('shows an empty-state message instead of the stats table when the company has no jobs (Req 5.3)', () => {
    useCompanyTechStatsQuery.mockReturnValue({ data: [] });
    const techs = [makeTech('typescript', 'language')];
    const company = makeCompany(['typescript'], { job_count: 0 });

    render(
      <CompanyDetailModal
        company={company}
        techs={techs}
        categoryLabelMap={categoryLabelMap}
        onClose={vi.fn()}
        onGoToJobs={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('tech-stat-row')).not.toBeInTheDocument();
    expect(screen.getByText('目前沒有職缺')).toBeInTheDocument();
  });
});
