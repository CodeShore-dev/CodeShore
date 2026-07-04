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

  it('parses excluded companies from the query', () => {
    render(
      <MemoryRouter initialEntries={['/jobs?notCompanies=Acme,Globex']}>
        <Harness />
      </MemoryRouter>,
    );

    expect(useJobFilterStore.getState().excludedCompanies).toEqual([
      'Acme',
      'Globex',
    ]);
  });

  it('writes excluded companies back to the URL', () => {
    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => {
      useJobFilterStore.getState().setExcludedCompanies(['Acme']);
    });

    expect(screen.getByTestId('search').textContent).toContain(
      'notCompanies=Acme',
    );
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
