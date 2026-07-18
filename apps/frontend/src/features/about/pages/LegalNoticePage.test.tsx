import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { LegalNoticePage } from './LegalNoticePage';

describe('LegalNoticePage', () => {
  it('renders the page title and description', () => {
    renderWithProviders(<LegalNoticePage />);
    expect(screen.getByRole('heading', { name: '法律聲明' })).toBeInTheDocument();
    expect(screen.getByText(/服務性質、資料來源/)).toBeInTheDocument();
  });

  it('renders every legal section heading', () => {
    renderWithProviders(<LegalNoticePage />);
    for (const heading of ['服務性質', '資料來源與準確性', '智慧財產權', '免責聲明']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('emits a BreadcrumbList JSON-LD with the current page', () => {
    renderWithProviders(<LegalNoticePage />);
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    expect(jsonLd).not.toBeNull();
    const parsed = JSON.parse(jsonLd!.textContent ?? '{}');
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(parsed.itemListElement.at(-1)).toMatchObject({
      name: '法律聲明',
      item: expect.stringContaining('/legal'),
    });
  });
});
