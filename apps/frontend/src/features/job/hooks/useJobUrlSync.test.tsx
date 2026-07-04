import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useJobFilterStore } from '../jobFilterStore';
import { useJobUrlSync } from './useJobUrlSync';

function Harness() {
  useJobUrlSync();
  const loc = useLocation();
  return <div data-testid="search">{loc.search}</div>;
}

beforeEach(() => {
  useJobFilterStore.getState().reset();
  useKeywordFilterStore.getState().reset();
});

describe('useJobUrlSync', () => {
  it('parses the query into the stores on mount (req 3.2, 1.4)', () => {
    render(
      <MemoryRouter
        initialEntries={['/jobs?tags=react,node&op=or&tab=like&page=2']}
      >
        <Harness />
      </MemoryRouter>,
    );

    expect(useKeywordFilterStore.getState().selectedTags).toEqual([
      'react',
      'node',
    ]);
    expect(useKeywordFilterStore.getState().keywordOperator).toBe('or');
    expect(useJobFilterStore.getState().listViewPreference).toBe('like');
    expect(useJobFilterStore.getState().page).toBe(2);
  });

  it('parses excluded companies from the query into companyFilters', () => {
    render(
      <MemoryRouter initialEntries={['/jobs?notCompanies=Acme,Globex']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme', mode: 'exclude' },
      { name: 'Globex', mode: 'exclude' },
    ]);
  });

  it('parses included companies from the query into companyFilters', () => {
    render(
      <MemoryRouter initialEntries={['/jobs?companies=Acme,Globex']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme', mode: 'include' },
      { name: 'Globex', mode: 'include' },
    ]);
  });

  it('parses both include and exclude company params together', () => {
    render(
      <MemoryRouter
        initialEntries={['/jobs?companies=Acme&notCompanies=Globex']}
      >
        <Harness />
      </MemoryRouter>,
    );

    expect(useJobFilterStore.getState().companyFilters).toEqual([
      { name: 'Acme', mode: 'include' },
      { name: 'Globex', mode: 'exclude' },
    ]);
  });

  it('writes include and exclude company filters back to the URL', () => {
    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => {
      useJobFilterStore.getState().addCompanyFilter('Acme');
      useJobFilterStore.getState().addCompanyFilter('Globex');
      useJobFilterStore.getState().toggleCompanyFilterMode('Globex');
    });

    const search = screen.getByTestId('search').textContent ?? '';
    expect(search).toContain('companies=Acme');
    expect(search).toContain('notCompanies=Globex');
  });

  it('round-trips include and exclude company entries through the URL', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => {
      useJobFilterStore.getState().addCompanyFilter('Acme');
      useJobFilterStore.getState().addCompanyFilter('Globex');
      useJobFilterStore.getState().toggleCompanyFilterMode('Globex');
    });

    const search = screen.getByTestId('search').textContent ?? '';
    unmount();
    useJobFilterStore.getState().reset();

    render(
      <MemoryRouter initialEntries={[`/jobs${search}`]}>
        <Harness />
      </MemoryRouter>,
    );

    expect(useJobFilterStore.getState().companyFilters).toEqual(
      expect.arrayContaining([
        { name: 'Acme', mode: 'include' },
        { name: 'Globex', mode: 'exclude' },
      ]),
    );
    expect(useJobFilterStore.getState().companyFilters).toHaveLength(2);
  });

  it('does not write a company param when there are no company filters', () => {
    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => {
      useJobFilterStore.getState().setSearchText('go');
    });

    const search = screen.getByTestId('search').textContent ?? '';
    expect(search).not.toContain('companies=');
    expect(search).not.toContain('notCompanies=');
    expect(search).not.toContain('company=');
  });

  it('writes store changes back to the URL', () => {
    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => {
      useJobFilterStore.getState().setSearchText('go');
    });

    expect(screen.getByTestId('search').textContent).toContain('search=go');
  });

  it('does not wipe parsed params on first render', () => {
    render(
      <MemoryRouter initialEntries={['/jobs?tags=react']}>
        <Harness />
      </MemoryRouter>,
    );
    // selectedTags stays parsed; URL still carries tags=react.
    expect(useKeywordFilterStore.getState().selectedTags).toEqual(['react']);
    expect(screen.getByTestId('search').textContent).toContain('tags=react');
  });
});
