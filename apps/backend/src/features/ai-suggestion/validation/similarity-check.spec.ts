/**
 * Fakes `TechService` the way `llm-client.spec.ts` fakes `@anthropic-ai/sdk`:
 * a stand-in module returning canned data instead of hitting a real
 * Supabase project. `findSimilarTech` only ever calls `fetchAll()`, per
 * `libs/data-utils/src/lib/shared-services/supabase/base.service.ts`.
 */
const fetchAllMock = vi.fn();

vi.mock('@codeshore/data-utils', () => ({
  TechService: vi.fn().mockImplementation(() => ({
    fetchAll: fetchAllMock,
  })),
}));

// Deliberately chosen so cross-matches are predictable: "React Router"
// substring-contains "React" (0.6), nothing else overlaps.
const techRows = [
  { id: 'react', category: 'frontend', label: 'React', tags: null, icon_slugs: null },
  { id: 'react-router', category: 'frontend', label: 'React Router', tags: null, icon_slugs: null },
  { id: 'vuejs', category: 'frontend', label: 'Vue.js', tags: null, icon_slugs: null },
  { id: 'go', category: 'backend', label: 'Go', tags: null, icon_slugs: null },
];

describe('findSimilarTech', () => {
  beforeEach(() => {
    fetchAllMock.mockReset();
    fetchAllMock.mockResolvedValue({
      result: techRows,
      count: techRows.length,
      searchParams: '',
    });
  });

  it('scores an exact normalized match (case/punctuation-insensitive) as 1.0', async () => {
    const { findSimilarTech } = await import('./similarity-check');

    // Hyphen + case differences are stripped by normalization, so this is
    // an exact match against "react". A threshold of 1 excludes the
    // substring-only match against "React Router" (0.6), isolating the
    // exact-match score being asserted here.
    const matches = await findSimilarTech('Re-Act', 1);

    expect(matches).toEqual([{ id: 'react', label: 'React', score: 1.0 }]);
  });

  it('scores a substring (non-equal) match as 0.6', async () => {
    const { findSimilarTech } = await import('./similarity-check');

    // "reactive" is not equal to "react" but contains it as a substring.
    const matches = await findSimilarTech('Reactive', 0);

    expect(matches).toEqual([{ id: 'react', label: 'React', score: 0.6 }]);
  });

  it('excludes non-matching tech entries entirely', async () => {
    const { findSimilarTech } = await import('./similarity-check');

    const matches = await findSimilarTech('Kubernetes', 0);

    expect(matches).toEqual([]);
  });

  it('filters out matches below the given threshold', async () => {
    const { findSimilarTech } = await import('./similarity-check');

    // "React" candidate exact-matches "react" (1.0) and substring-matches
    // "react-router" via "React Router" (0.6); threshold 0.9 keeps only the
    // exact match.
    const matches = await findSimilarTech('React', 0.9);

    expect(matches).toEqual([{ id: 'react', label: 'React', score: 1.0 }]);
  });

  it('sorts results by score descending', async () => {
    const { findSimilarTech } = await import('./similarity-check');

    const matches = await findSimilarTech('React', 0);

    expect(matches.map(m => m.id)).toEqual(['react', 'react-router']);
  });
});
