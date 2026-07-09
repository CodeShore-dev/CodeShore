import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('renders 頁面不存在 message (req 4.3)', () => {
    renderWithProviders(<NotFoundPage />);
    expect(screen.getByText('頁面不存在')).toBeInTheDocument();
  });

  it('renders a link back to the home page (req 4.3)', () => {
    renderWithProviders(<NotFoundPage />);
    const link = screen.getByRole('link', { name: /返回首頁/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('adds noIndex robots meta tag to prevent search engine indexing (req 4.3)', () => {
    renderWithProviders(<NotFoundPage />);
    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta).not.toBeNull();
    expect(robotsMeta?.getAttribute('content')).toBe('noindex,nofollow');
  });
});
