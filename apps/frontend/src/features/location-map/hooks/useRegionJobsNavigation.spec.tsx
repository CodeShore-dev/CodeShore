import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `useRegionJobsNavigation` reuses the already-committed `useLocationGroupsQuery`
// (`../queries`, task 5.1) for county-tier "查看此地區職缺" -- same mocking
// boundary the extracted-from `RegionDetailPanel.test.tsx` used, so behavior
// parity can be asserted with identical fixtures.
const { useLocationGroupsQuery } = vi.hoisted(() => ({
  useLocationGroupsQuery: vi.fn(),
}));

vi.mock('../queries', () => ({
  useLocationGroupsQuery,
}));

import { useRegionJobsNavigation } from './useRegionJobsNavigation';

// Same real-router assertion convention as `RegionDetailPanel.test.tsx` /
// `useJobUrlSync.test.tsx` -- no test in this repo mocks `react-router`
// directly, so `navigate` results are read back via a sibling `useLocation()`
// probe inside a real `MemoryRouter`, not by mocking `useNavigate`.
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function Harness({
  regionId,
  tier,
}: {
  regionId: string;
  tier: 'county' | 'district';
}) {
  const { goToJobs, goToJobsWithTech } = useRegionJobsNavigation(
    regionId,
    tier,
  );
  return (
    <>
      <button type="button" onClick={goToJobs}>
        查看此地區職缺
      </button>
      <button type="button" onClick={() => goToJobsWithTech('react')}>
        tech-react
      </button>
    </>
  );
}

function renderHarness(props: { regionId: string; tier: 'county' | 'district' }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/location-map']}>
        <Harness {...props} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function readNavigatedParams(): URLSearchParams | null {
  const text = screen.getByTestId('location').textContent ?? '';
  const [, search] = text.split('?');
  if (search === undefined) return null;
  return new URLSearchParams(search);
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationGroupsQuery.mockReturnValue({ data: [], isLoading: false });
});

describe('useRegionJobsNavigation', () => {
  it('county tier goToJobs navigates with every location_group id under that county, comma-joined (Requirement 6.1)', async () => {
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市信義區', count: 10 },
        { location: '台北市大安區', count: 5 },
        // A different county's rows must NOT leak into 台北市's id list.
        { location: '新北市板橋區', count: 3 },
        // Malformed rows (groupByCounty excludes these, Requirement 7.2)
        // must not break or appear in the county's id list.
        { location: '信義區', count: 1 },
      ],
      isLoading: false,
    });
    const user = userEvent.setup();

    renderHarness({ regionId: '台北市', tier: 'county' });

    await user.click(screen.getByRole('button', { name: '查看此地區職缺' }));

    const text = screen.getByTestId('location').textContent ?? '';
    expect(text.startsWith('/jobs')).toBe(true);
    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區,台北市大安區');
    expect(params?.has('tags')).toBe(false);
  });

  it('district tier goToJobs navigates with just that single location_group id (Requirement 6.2)', async () => {
    const user = userEvent.setup();

    renderHarness({ regionId: '台北市信義區', tier: 'district' });

    await user.click(screen.getByRole('button', { name: '查看此地區職缺' }));

    const text = screen.getByTestId('location').textContent ?? '';
    expect(text.startsWith('/jobs')).toBe(true);
    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區');
    expect(params?.has('tags')).toBe(false);
  });

  it('district tier goToJobsWithTech navigates with both locations and tags (Requirement 6.3)', async () => {
    const user = userEvent.setup();

    renderHarness({ regionId: '台北市信義區', tier: 'district' });

    await user.click(screen.getByText('tech-react'));

    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區');
    expect(params?.get('tags')).toBe('react');
  });

  it('county tier goToJobsWithTech navigates with the whole county location list and tags (Requirement 6.3)', async () => {
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市信義區', count: 10 },
        { location: '台北市大安區', count: 5 },
      ],
      isLoading: false,
    });
    const user = userEvent.setup();

    renderHarness({ regionId: '台北市', tier: 'county' });

    await user.click(screen.getByText('tech-react'));

    const params = readNavigatedParams();
    expect(params?.get('locations')).toBe('台北市信義區,台北市大安區');
    expect(params?.get('tags')).toBe('react');
  });
});
