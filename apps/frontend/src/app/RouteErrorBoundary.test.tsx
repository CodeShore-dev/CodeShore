import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

// Mock env so PageSeo (rendered by RouteErrorBoundary) is deterministic.
vi.mock('../config/env', () => ({
  env: {
    isDev: false,
    baseUrl: '/',
    appVersion: 'test',
    adminEmails: [],
    supabaseUrl: 'http://localhost',
    supabaseAnonKey: 'anon-key',
    siteUrl: 'https://codeshore.dev',
  },
}));

import { RouteErrorBoundary } from './RouteErrorBoundary';

function ThrowingPage({ message }: { message: string }): never {
  throw new Error(message);
}

function renderWithError(message: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <ThrowingPage message={message} />,
        errorElement: <RouteErrorBoundary />,
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('RouteErrorBoundary', () => {
  it('shows a stale-build message for a dynamic-import chunk failure', () => {
    renderWithError(
      'Failed to fetch dynamically imported module: https://codeshore.dev/assets/JobPreferencePage-CU0Q3D-2.js',
    );
    expect(screen.getByText('網站已更新')).toBeInTheDocument();
  });

  it('shows a generic error message for other render errors', () => {
    renderWithError('boom');
    expect(screen.getByText('發生未預期的錯誤')).toBeInTheDocument();
  });

  it('renders a reload button and a home link', () => {
    renderWithError('boom');
    expect(
      screen.getByRole('button', { name: '重新整理' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首頁' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
