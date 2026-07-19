import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SupabaseView } from '@codeshore/data-types';

import { renderWithProviders } from '../../../test/renderWithProviders';

// `parents` models the language/platform <-> framework hierarchy (e.g.
// 'react' belongs under 'javascript'); see tech-hierarchy.generator.ts. The
// pairing logic under test walks this edge to merge a framework chip into
// its present parent language's chip.
const { mvTechFixture } = vi.hoisted(() => ({
  mvTechFixture: [
    {
      tech: 'python',
      label: 'Python',
      category: 'language',
      count: 20,
      keywords: ['python'],
      icon_slugs: null,
      children: ['django', 'flask'],
      parents: [],
      tags: [],
    },
    {
      tech: 'django',
      label: 'Django',
      category: 'framework',
      count: 10,
      keywords: ['django'],
      icon_slugs: null,
      children: [],
      parents: ['python'],
      tags: [],
    },
    {
      tech: 'flask',
      label: 'Flask',
      category: 'framework',
      count: 5,
      keywords: ['flask'],
      icon_slugs: null,
      children: [],
      parents: ['python'],
      tags: [],
    },
    {
      tech: 'nextjs',
      label: 'Next.js',
      category: 'framework',
      count: 10,
      keywords: ['nextjs', 'next.js'],
      icon_slugs: null,
      children: [],
      parents: ['javascript'],
      tags: [],
    },
    {
      tech: 'go',
      label: 'Go',
      category: 'language',
      count: 6,
      keywords: ['go', 'golang'],
      icon_slugs: null,
      children: [],
      parents: [],
      tags: [],
    },
    {
      tech: 'postgresql',
      label: 'PostgreSQL',
      category: 'database',
      count: 8,
      keywords: ['postgresql', 'postgres'],
      icon_slugs: null,
      children: [],
      parents: [],
      tags: [],
    },
  ],
}));

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({ result: mvTechFixture }),
}));

import { JobListItem } from './JobListItem';

const baseJob = {
  id: 'job-1',
  title: 'React 資深工程師',
  company_name: 'Acme 科技',
  location: '台北',
  salary: '面議',
  closed: false,
  detail_link: 'https://example.com/1',
  updated_at: new Date('2026-06-23T00:00:00Z'),
} as unknown as SupabaseView.MvJob;

const noopProps = {
  selected: false,
  listViewPreference: null as const,
  disabled: false,
  onSelect: vi.fn(),
  onPreference: vi.fn(),
};

// Each tech-stack chip is a CompanyCard-style rounded-full pill (icon +
// label), with no language/framework/database label prefix -- find a chip by
// one of its item labels.
function getChip(itemLabel: string): HTMLElement {
  return screen.getByText(itemLabel).closest('[data-testid="tech-chip"]') as HTMLElement;
}

describe('JobListItem - tech stack chips pair a language with its present framework(s)', () => {
  it('merges a framework into its present parent language as one chip', async () => {
    renderWithProviders(
      <ul>
        <JobListItem
          {...noopProps}
          job={{
            ...baseJob,
            keyword_groups: [],
            tech_mappings: ['python:Python', 'django:Django'],
          }}
        />
      </ul>,
    );

    await waitFor(() => screen.getByText('Python'));
    const chip = getChip('Python');
    expect(within(chip).getByText('Django')).toBeInTheDocument();
    expect(within(chip).getByText('+')).toBeInTheDocument();
    // Only a single chip rendered -- not two separate ones.
    expect(document.querySelectorAll('[data-testid="tech-chip"]')).toHaveLength(1);
  });

  it('joins multiple frameworks under the same present language into one chip', async () => {
    renderWithProviders(
      <ul>
        <JobListItem
          {...noopProps}
          job={{
            ...baseJob,
            keyword_groups: [],
            tech_mappings: ['python:Python', 'django:Django', 'flask:Flask'],
          }}
        />
      </ul>,
    );

    await waitFor(() => screen.getByText('Python'));
    const chip = getChip('Python');
    expect(within(chip).getByText('Django')).toBeInTheDocument();
    expect(within(chip).getByText('Flask')).toBeInTheDocument();
    expect(within(chip).getByText('+')).toBeInTheDocument();
    expect(within(chip).getByText('/')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="tech-chip"]')).toHaveLength(1);
  });

  it('shows a framework standalone when its parent language is not present in the job', async () => {
    renderWithProviders(
      <ul>
        <JobListItem
          {...noopProps}
          job={{
            ...baseJob,
            keyword_groups: [],
            // nextjs's parent is 'javascript', which is not in this job's techs.
            tech_mappings: ['nextjs:Next.js'],
          }}
        />
      </ul>,
    );

    await waitFor(() => screen.getByText('Next.js'));
    const chip = getChip('Next.js');
    expect(within(chip).queryByText('+')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="tech-chip"]')).toHaveLength(1);
  });

  it('shows a language standalone when it has no present framework', async () => {
    renderWithProviders(
      <ul>
        <JobListItem
          {...noopProps}
          job={{
            ...baseJob,
            keyword_groups: [],
            tech_mappings: ['go:Go'],
          }}
        />
      </ul>,
    );

    await waitFor(() => screen.getByText('Go'));
    const chip = getChip('Go');
    expect(within(chip).queryByText('+')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="tech-chip"]')).toHaveLength(1);
  });

  it('keeps database chips separate from language/framework pairing', async () => {
    renderWithProviders(
      <ul>
        <JobListItem
          {...noopProps}
          job={{
            ...baseJob,
            keyword_groups: [],
            tech_mappings: [
              'python:Python',
              'django:Django',
              'postgresql:PostgreSQL',
            ],
          }}
        />
      </ul>,
    );

    await waitFor(() => screen.getByText('Python'));
    const languageChip = getChip('Python');
    expect(within(languageChip).getByText('Django')).toBeInTheDocument();

    const databaseChip = getChip('PostgreSQL');
    expect(databaseChip).not.toBe(languageChip);
    expect(within(databaseChip).queryByText('+')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="tech-chip"]')).toHaveLength(2);
  });

  it('renders no tech chips when both keyword_groups and tech_mappings are empty', async () => {
    renderWithProviders(
      <ul>
        <JobListItem
          {...noopProps}
          job={{ ...baseJob, keyword_groups: [], tech_mappings: [] }}
        />
      </ul>,
    );

    await waitFor(() => {
      expect(screen.getByText(baseJob.title)).toBeInTheDocument();
    });
    expect(document.querySelectorAll('[data-testid="tech-chip"]')).toHaveLength(0);
  });
});
