import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP } from '../utils/constants';
import { KeywordTechRankingCardList } from './KeywordTechRankingCardList';

const items = [
  {
    keyword_group: 'react',
    label: 'React',
    icon_slugs: [],
    tags: [],
    job_count: 1234,
  },
] as unknown as SupabaseView.MvKeywordGroupRanking[];

function renderList(getItems = vi.fn()) {
  render(
    <MemoryRouter>
      <KeywordTechRankingCardList
        title="熱門語言"
        items={items}
        loading={false}
        getItems={getItems}
      />
    </MemoryRouter>,
  );
  return getItems;
}

describe('KeywordTechRankingCardList', () => {
  it('fetches the initial language category and renders items (req 5.1)', () => {
    const getItems = renderList();
    expect(getItems).toHaveBeenCalledWith('language');
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('refetches when the category changes', async () => {
    const getItems = vi.fn();
    const user = userEvent.setup();
    renderList(getItems);
    getItems.mockClear();

    const other = Object.entries(CATEGORY_LABEL_MAP)
      .slice(0, 4)
      .find(([value]) => value !== 'language');
    expect(other).toBeTruthy();

    await user.click(screen.getByText(other![1]));

    expect(getItems).toHaveBeenCalledWith(other![0]);
  });
});
