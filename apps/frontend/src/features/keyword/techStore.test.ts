import { beforeEach, describe, expect, it } from 'vitest';

import { useTechStore } from './techStore';

const reset = () =>
  useTechStore.setState({
    groupsFilter: 'all',
    search: '',
    currentPage: 3,
    selectMode: false,
    selectedIds: new Set<string>(),
  });

describe('useTechStore', () => {
  beforeEach(reset);

  it('resets to page 1 when the filter changes', () => {
    useTechStore.getState().setGroupsFilter('grouped');
    expect(useTechStore.getState().groupsFilter).toBe('grouped');
    expect(useTechStore.getState().currentPage).toBe(1);
  });

  it('resets to page 1 when the search changes', () => {
    useTechStore.getState().setSearch('react');
    expect(useTechStore.getState().currentPage).toBe(1);
  });

  it('toggles ids in and out of the selection', () => {
    const { toggleSelectId } = useTechStore.getState();
    toggleSelectId('a');
    toggleSelectId('b');
    expect([...useTechStore.getState().selectedIds]).toEqual(['a', 'b']);
    toggleSelectId('a');
    expect([...useTechStore.getState().selectedIds]).toEqual(['b']);
  });

  it('clears the selection when leaving select mode', () => {
    useTechStore.setState({ selectMode: true });
    useTechStore.getState().selectAll(['a', 'b']);
    expect(useTechStore.getState().selectedIds.size).toBe(2);
    useTechStore.getState().toggleSelectMode();
    expect(useTechStore.getState().selectMode).toBe(false);
    expect(useTechStore.getState().selectedIds.size).toBe(0);
  });
});
