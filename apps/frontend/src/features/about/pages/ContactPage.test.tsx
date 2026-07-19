import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { ContactPage } from './ContactPage';

describe('ContactPage', () => {
  it('renders the page title and description', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('heading', { name: '聯絡我們' })).toBeInTheDocument();
    expect(screen.getByText(/最即時的聯絡管道/)).toBeInTheDocument();
  });

  it('provides a mailto contact link', () => {
    renderWithProviders(<ContactPage />);
    const link = screen.getByRole('link', { name: /ucnsaythtagn@gmail\.com/ });
    expect(link).toHaveAttribute('href', 'mailto:ucnsaythtagn@gmail.com');
  });

  it('links to the GitHub repository and issues', () => {
    renderWithProviders(<ContactPage />);
    expect(screen.getByRole('link', { name: /在 GitHub Issues 發起討論/i })).toHaveAttribute(
      'href',
      'https://github.com/CodeShore-dev/CodeShore/issues',
    );
    expect(screen.getByRole('link', { name: /前往 GitHub 儲存庫/i })).toHaveAttribute(
      'href',
      'https://github.com/CodeShore-dev/CodeShore',
    );
  });

  it('emits a BreadcrumbList JSON-LD with the current page', () => {
    renderWithProviders(<ContactPage />);
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    expect(jsonLd).not.toBeNull();
    const parsed = JSON.parse(jsonLd!.textContent ?? '{}');
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(parsed.itemListElement.at(-1)).toMatchObject({
      name: '聯絡我們',
      item: expect.stringContaining('/contact'),
    });
  });
});
