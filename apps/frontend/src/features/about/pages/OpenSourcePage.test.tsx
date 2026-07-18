import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { OpenSourcePage } from './OpenSourcePage';

describe('OpenSourcePage', () => {
  it('renders the page title and description (footer 關於 section)', () => {
    renderWithProviders(<OpenSourcePage />);
    expect(screen.getByRole('heading', { name: '開源於 GitHub' })).toBeInTheDocument();
    expect(screen.getByText(/完整公開在 GitHub 上/)).toBeInTheDocument();
  });

  it('links to the public GitHub repository in a new tab', () => {
    renderWithProviders(<OpenSourcePage />);
    const link = screen.getByRole('link', { name: /前往 GitHub 儲存庫/i });
    expect(link).toHaveAttribute('href', 'https://github.com/CodeShore-dev/CodeShore');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('lists the tech stack sections', () => {
    renderWithProviders(<OpenSourcePage />);
    expect(screen.getByText('技術堆疊')).toBeInTheDocument();
    expect(screen.getByText('如何參與')).toBeInTheDocument();
  });

  it('emits a BreadcrumbList JSON-LD with the current page', () => {
    renderWithProviders(<OpenSourcePage />);
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    expect(jsonLd).not.toBeNull();
    const parsed = JSON.parse(jsonLd!.textContent ?? '{}');
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(parsed.itemListElement.at(-1)).toMatchObject({
      name: '開源於 GitHub',
      item: expect.stringContaining('/open-source'),
    });
  });
});
