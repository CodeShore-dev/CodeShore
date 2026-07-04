import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
      {
        tech: 'some-framework',
        label: 'Some Framework',
        category: '',
        count: 5,
        keywords: ['some-framework'],
        icon_slugs: null,
        children: [],
        parents: ['unknown-parent-id'],
        tags: [],
      },
    ],
  }),
  fetchTechCategories: vi.fn().mockResolvedValue({ result: [] }),
  updateTech: vi.fn().mockResolvedValue(undefined),
}));

import { JobTechFilterPanel } from './JobTechFilterPanel';

describe('JobTechFilterPanel', () => {
  it('renders a parent by its resolved catalog label instead of the raw id', async () => {
    renderWithProviders(<JobTechFilterPanel />);

    await screen.findByText('React');

    // "react" has parent id "javascript", which has a matching catalog
    // record with label "JavaScript" -- the resolved label should render as
    // the parent chip's text, not the raw parent id string. "JavaScript"
    // also appears as its own top-level tech item's label, so scope the
    // assertion to the parent chip specifically (identified by its class).
    const parentChips = document.querySelectorAll(
      '.rounded-full.border.border-current\\/30',
    );
    const parentChipTexts = Array.from(parentChips).map(el => el.textContent);
    expect(parentChipTexts).toContain('JavaScript');
    expect(parentChipTexts).not.toContain('javascript');
  });

  it('falls back to the raw parent id string when no catalog record matches', async () => {
    renderWithProviders(<JobTechFilterPanel />);

    await screen.findByText('Some Framework');

    // "some-framework" has parent id "unknown-parent-id", which has no
    // matching catalog record -- the raw id should still render (not blank).
    expect(screen.getByText('unknown-parent-id')).toBeInTheDocument();
  });

  it('applies non-shrinking, tabular-number styling to the count badge so it cannot be squeezed at mobile widths (Req 3.1, 3.2)', async () => {
    renderWithProviders(<JobTechFilterPanel />);

    const countEl = await screen.findByText('10');

    expect(countEl.className).toContain('shrink-0');
    expect(countEl.className).toContain('tabular-nums');
  });

  it('protects the tech label with min-w-0/truncate so long labels do not push the count out of alignment (Req 3.1, 3.2)', async () => {
    renderWithProviders(<JobTechFilterPanel />);

    const labelEl = await screen.findByText('React');

    expect(labelEl.className).toContain('truncate');

    // truncate only takes effect in a flex layout if an ancestor flex
    // container constrains its min-width via min-w-0 (flex items default to
    // min-width: auto). The label's immediate flex-row ancestor must carry
    // min-w-0 for the truncation to actually apply.
    const labelRow = labelEl.parentElement;
    expect(labelRow?.className).toContain('min-w-0');
  });
});
