import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { useJobFilterStore } from '../jobFilterStore';

vi.mock('../service', () => ({
  fetchLocationGroups: vi.fn().mockResolvedValue({
    result: [
      { location: '台北市信義區', count: 10 },
      { location: '台北市大安區', count: 5 },
      { location: '台北市', count: 2 },
      { location: '新北市板橋區', count: 3 },
    ],
  }),
}));

import { JobLocationFilterPanel } from './JobLocationFilterPanel';

describe('JobLocationFilterPanel', () => {
  beforeEach(() => {
    useJobFilterStore.getState().reset();
  });

  it('defaults to the 縣市 tab, grouping districts under their county', async () => {
    renderWithProviders(<JobLocationFilterPanel />);

    await screen.findByText('台北市');
    expect(screen.getByText('新北市')).toBeInTheDocument();
    expect(screen.queryByText('台北市信義區')).not.toBeInTheDocument();
  });

  it('switching to the 地區排名 tab shows the flat, count-sorted list', async () => {
    renderWithProviders(<JobLocationFilterPanel />);
    await screen.findByText('台北市');

    fireEvent.click(screen.getByText('地區排名'));

    await screen.findByText('台北市信義區');
    expect(screen.getByText('台北市大安區')).toBeInTheDocument();
    expect(screen.getByText('新北市板橋區')).toBeInTheDocument();
  });

  it('selecting a county adds every district under it, including a bare county-level row, to selectedLocations', async () => {
    renderWithProviders(<JobLocationFilterPanel />);

    const taipei = await screen.findByText('台北市');
    fireEvent.click(taipei);

    await waitFor(() => {
      expect(useJobFilterStore.getState().selectedLocations.sort()).toEqual(
        ['台北市信義區', '台北市大安區', '台北市'].sort(),
      );
    });
  });

  it('clicking an already fully-selected county removes all its districts (including the bare county row)', async () => {
    useJobFilterStore
      .getState()
      .setSelectedLocations([
        '台北市信義區',
        '台北市大安區',
        '台北市',
        '新北市板橋區',
      ]);

    renderWithProviders(<JobLocationFilterPanel />);

    const taipei = await screen.findByText('台北市');
    fireEvent.click(taipei);

    await waitFor(() => {
      expect(useJobFilterStore.getState().selectedLocations).toEqual([
        '新北市板橋區',
      ]);
    });
  });

  it('selecting a county in the 縣市 tab is reflected as selected districts in the 地區排名 tab', async () => {
    renderWithProviders(<JobLocationFilterPanel />);

    const taipei = await screen.findByText('台北市');
    fireEvent.click(taipei);

    await waitFor(() => {
      expect(useJobFilterStore.getState().selectedLocations).toHaveLength(3);
    });

    fireEvent.click(screen.getByText('地區排名'));
    const taipeiXinyi = await screen.findByText('台北市信義區');
    const banqiao = screen.getByText('新北市板橋區');
    expect(taipeiXinyi.parentElement?.className).toContain(
      'bg-primary text-on-primary',
    );
    expect(banqiao.parentElement?.className).not.toContain(
      'bg-primary text-on-primary',
    );
  });
});
