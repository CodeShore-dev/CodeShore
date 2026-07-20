import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({ gaMeasurementId: '', isDev: true }));

vi.mock('../config/env', () => ({ env: mockEnv }));

async function loadAnalytics(): Promise<ComponentType> {
  vi.resetModules();
  const mod = await import('./Analytics');
  return mod.Analytics;
}

function Nav() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/b')}>
      go b
    </button>
  );
}

function renderAnalytics(Analytics: ComponentType) {
  return render(
    <MemoryRouter initialEntries={['/a']}>
      <Analytics />
      <Nav />
      <Routes>
        <Route path="/a" element={<div>page A</div>} />
        <Route path="/b" element={<div>page B</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.head
    .querySelectorAll('script[src*="googletagmanager"]')
    .forEach(el => el.remove());
  Reflect.deleteProperty(window, 'gtag');
  Reflect.deleteProperty(window, 'dataLayer');
});

describe('Analytics', () => {
  it('does nothing when no measurement ID is configured', async () => {
    mockEnv.gaMeasurementId = '';
    mockEnv.isDev = false;
    const Analytics = await loadAnalytics();

    renderAnalytics(Analytics);

    expect(
      document.head.querySelector('script[src*="googletagmanager"]'),
    ).not.toBeInTheDocument();
  });

  it('does nothing in dev mode even with a measurement ID configured', async () => {
    mockEnv.gaMeasurementId = 'G-TEST123';
    mockEnv.isDev = true;
    const Analytics = await loadAnalytics();

    renderAnalytics(Analytics);

    expect(
      document.head.querySelector('script[src*="googletagmanager"]'),
    ).not.toBeInTheDocument();
  });

  it('loads gtag.js and sends exactly one page_view per route (initial + navigation)', async () => {
    mockEnv.gaMeasurementId = 'G-TEST123';
    mockEnv.isDev = false;
    const Analytics = await loadAnalytics();
    const user = userEvent.setup();

    renderAnalytics(Analytics);

    expect(
      document.head.querySelector(
        'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]',
      ),
    ).toBeInTheDocument();

    const pageViewPaths = () =>
      window.dataLayer
        .filter(
          (call): call is [string, string, Record<string, unknown>] =>
            Array.isArray(call) && call[0] === 'event' && call[1] === 'page_view',
        )
        .map(call => call[2].page_path);

    expect(pageViewPaths()).toEqual(['/a']);

    await user.click(screen.getByText('go b'));

    expect(screen.getByText('page B')).toBeInTheDocument();
    expect(pageViewPaths()).toEqual(['/a', '/b']);
  });
});
