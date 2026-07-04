import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../../keyword/service', () => ({
  fetchMvTech: vi.fn().mockResolvedValue({
    result: [
      {
        tech: 'react',
        label: 'React',
        category: 'frontend',
        count: 10,
        keywords: ['react'],
        icon_slugs: ['simple-icons:react'],
        children: [],
        parents: [],
        tags: [],
      },
      {
        tech: 'cobol',
        label: 'COBOL',
        category: 'backend',
        count: 1,
        keywords: ['cobol'],
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

import { JobDescriptionHighlighter } from './JobDescriptionHighlighter';

describe('JobDescriptionHighlighter', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<svg><path d="M0 0"/></svg>'),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mounts a TechIcon inline for a chip whose tech has icon data', async () => {
    renderWithProviders(
      <JobDescriptionHighlighter
        htmlContent="<p>We use React every day.</p>"
        techs={['react']}
        selectedTechs={new Set()}
        onTooltipShow={() => undefined}
        onTooltipHide={() => undefined}
        onTechSelect={() => undefined}
      />,
    );

    await screen.findByText('React', { selector: '[data-tech="react"]' });

    // Re-query the chip fresh each check: the dangerouslySetInnerHTML subtree
    // can be replaced across unrelated re-renders, so a stale node reference
    // would flake here.
    await waitFor(() => {
      const chip = document.querySelector('[data-tech="react"]') as HTMLElement;
      const mount = chip.querySelector('[data-tech-icon-mount]') as HTMLElement | null;
      expect(mount?.querySelector('.techicon')).toBeInTheDocument();
    });
  });

  it('does not crash and renders no icon for a chip whose tech has no icon data', async () => {
    renderWithProviders(
      <JobDescriptionHighlighter
        htmlContent="<p>Legacy systems still run COBOL.</p>"
        techs={['cobol']}
        selectedTechs={new Set()}
        onTooltipShow={() => undefined}
        onTooltipHide={() => undefined}
        onTechSelect={() => undefined}
      />,
    );

    await screen.findByText('COBOL', { selector: '[data-tech="cobol"]' });

    const chip = document.querySelector('[data-tech="cobol"]') as HTMLElement;
    const mount = chip.querySelector('[data-tech-icon-mount]') as HTMLElement | null;
    expect(mount).toBeTruthy();

    // TechIcon's default hideIfNotFound renders nothing once settled, since
    // this tech has no icon_slugs to resolve. Wait for the mount span's
    // children to settle (fetch/mocks flush), then assert no icon appears.
    await waitFor(() => {
      const freshChip = document.querySelector('[data-tech="cobol"]') as HTMLElement;
      const freshMount = freshChip.querySelector(
        '[data-tech-icon-mount]',
      ) as HTMLElement;
      expect(freshMount.querySelector('.techicon')).not.toBeInTheDocument();
    });
  });
});
