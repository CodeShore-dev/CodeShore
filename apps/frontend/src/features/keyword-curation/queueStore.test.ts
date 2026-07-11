import { beforeEach, describe, expect, it } from 'vitest';

import { useQueueStore } from './queueStore';

const reset = () =>
  useQueueStore.setState({
    currentPage: 1,
    selectMode: false,
    selectedIds: new Set<string>(),
  });

describe('useQueueStore', () => {
  beforeEach(reset);

  it('sets the current page', () => {
    useQueueStore.getState().setPage(3);
    expect(useQueueStore.getState().currentPage).toBe(3);
  });

  it('toggles ids in and out of the selection', () => {
    const { toggleSelectId } = useQueueStore.getState();
    toggleSelectId('reactjs');
    toggleSelectId('vuejs');
    expect([...useQueueStore.getState().selectedIds]).toEqual([
      'reactjs',
      'vuejs',
    ]);
    toggleSelectId('reactjs');
    expect([...useQueueStore.getState().selectedIds]).toEqual(['vuejs']);
  });

  it('selects all given ids, replacing the current selection', () => {
    useQueueStore.getState().toggleSelectId('stale');
    useQueueStore.getState().selectAll(['reactjs', 'vuejs']);
    expect([...useQueueStore.getState().selectedIds].sort()).toEqual([
      'reactjs',
      'vuejs',
    ]);
  });

  it('clears the selection', () => {
    useQueueStore.getState().selectAll(['reactjs']);
    useQueueStore.getState().clearSelection();
    expect(useQueueStore.getState().selectedIds.size).toBe(0);
  });

  it('clears the selection when leaving select mode', () => {
    useQueueStore.setState({ selectMode: true });
    useQueueStore.getState().selectAll(['reactjs', 'vuejs']);
    expect(useQueueStore.getState().selectedIds.size).toBe(2);

    useQueueStore.getState().toggleSelectMode();

    expect(useQueueStore.getState().selectMode).toBe(false);
    expect(useQueueStore.getState().selectedIds.size).toBe(0);
  });

  it('does not clear the selection when entering select mode', () => {
    useQueueStore.getState().toggleSelectMode();
    expect(useQueueStore.getState().selectMode).toBe(true);
    expect(useQueueStore.getState().selectedIds.size).toBe(0);
  });
});
