import { beforeEach, describe, expect, it } from 'vitest';

import { useJobFilterStore } from './jobFilterStore';

beforeEach(() => {
  useJobFilterStore.getState().reset();
  useJobFilterStore.setState({ page: 4 });
});

describe('jobFilterStore', () => {
  it('resets to page 1 when a filter changes (req 3.2)', () => {
    useJobFilterStore.getState().setSearchText('react');
    expect(useJobFilterStore.getState().page).toBe(1);
  });

  it('does not reset page when only selectedJobId changes', () => {
    useJobFilterStore.getState().setSelectedJobId('job-1');
    expect(useJobFilterStore.getState().page).toBe(4);
  });
});
