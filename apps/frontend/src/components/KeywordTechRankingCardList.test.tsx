import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP } from '../utils/constants';
import { KeywordTechRankingCardList } from './KeywordTechRankingCardList';

const items = [
  {
    tech: 'react',
    label: 'React',
    icon_slugs: [],
    tags: [],
    job_count: 1234,
  },
] as unknown as SupabaseView.MvTechRanking[];

function renderList(onCategoryChange = vi.fn()) {
  render(
    <MemoryRouter>
      <KeywordTechRankingCardList
        title="熱門語言"
        items={items}
        loading={false}
        selectedCategory="language"
        onCategoryChange={onCategoryChange}
      />
    </MemoryRouter>,
  );
  return onCategoryChange;
}

describe('KeywordTechRankingCardList', () => {
  it('renders the items it is given (req 5.1)', () => {
    renderList();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('reports the category when a different category is clicked', async () => {
    const user = userEvent.setup();
    const onCategoryChange = renderList();

    const other = Object.entries(CATEGORY_LABEL_MAP)
      .slice(0, 4)
      .find(([value]) => value !== 'language');
    expect(other).toBeTruthy();

    await user.click(screen.getByText(other![1]));

    expect(onCategoryChange).toHaveBeenCalledWith(other![0]);
  });
});
