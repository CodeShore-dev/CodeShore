import { beforeEach, describe, expect, it } from 'vitest';

import { useKeywordGroupStore } from './keywordGroupStore';

const reset = () =>
  useKeywordGroupStore.setState({
    groupsFilter: 'all',
    search: '',
    currentPage: 3,
    selectMode: false,
    selectedIds: new Set<string>(),
  });

describe('useKeywordGroupStore', () => {
  beforeEach(reset);

  it('resets to page 1 when the filter changes', () => {
    useKeywordGroupStore.getState().setGroupsFilter('grouped');
    expect(useKeywordGroupStore.getState().groupsFilter).toBe('grouped');
    expect(useKeywordGroupStore.getState().currentPage).toBe(1);
  });

  it('resets to page 1 when the search changes', () => {
    useKeywordGroupStore.getState().setSearch('react');
    expect(useKeywordGroupStore.getState().currentPage).toBe(1);
  });

  it('toggles ids in and out of the selection', () => {
    const { toggleSelectId } = useKeywordGroupStore.getState();
    toggleSelectId('a');
    toggleSelectId('b');
    expect([...useKeywordGroupStore.getState().selectedIds]).toEqual(['a', 'b']);
    toggleSelectId('a');
    expect([...useKeywordGroupStore.getState().selectedIds]).toEqual(['b']);
  });

  it('clears the selection when leaving select mode', () => {
    useKeywordGroupStore.setState({ selectMode: true });
    useKeywordGroupStore.getState().selectAll(['a', 'b']);
    expect(useKeywordGroupStore.getState().selectedIds.size).toBe(2);
    useKeywordGroupStore.getState().toggleSelectMode();
    expect(useKeywordGroupStore.getState().selectMode).toBe(false);
    expect(useKeywordGroupStore.getState().selectedIds.size).toBe(0);
  });
});
