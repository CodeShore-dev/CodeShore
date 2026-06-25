import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../service', () => ({
  fetchMethodologySql: vi.fn().mockResolvedValue({}),
}));

import { methodologySections } from '../content/sections';
import { MethodologyPage } from './MethodologyPage';

describe('MethodologyPage', () => {
  it('renders the heading, content sections, and SQL section (req 8.3)', () => {
    renderWithProviders(<MethodologyPage />);

    expect(screen.getByText('公開透明')).toBeInTheDocument();
    expect(screen.getByText('資料來源 SQL')).toBeInTheDocument();
    // First content section title from the reused content module.
    expect(
      screen.getByText(methodologySections[0].title),
    ).toBeInTheDocument();
  });

  it('gives each section an id for hash deep-linking (req 8.2)', () => {
    const { container } = renderWithProviders(<MethodologyPage />);
    expect(
      container.querySelector(`#${methodologySections[0].id}`),
    ).not.toBeNull();
  });

  it('renders the cloud-architecture section in addition to existing sections (req 1.1, 1.4)', () => {
    const { container } = renderWithProviders(<MethodologyPage />);

    // New cloud-architecture section is present and deep-link reachable.
    expect(container.querySelector('#cloud-architecture')).not.toBeNull();
    expect(screen.getByText('雲端架構關係圖')).toBeInTheDocument();

    // Regression: existing content sections + source-sql still render (add, don't replace).
    expect(container.querySelector('#cloud-performance')).not.toBeNull();
    expect(container.querySelector('#data-crawler')).not.toBeNull();
    expect(container.querySelector('#source-sql')).not.toBeNull();
  });

  it('renders the diagram responsively within the page (req 5.1, 5.2)', () => {
    // Coverage gap: prove the embedded diagram renders responsively in page
    // context. The diagram sits in a bounded box that scrolls horizontally on
    // narrow screens (overflow-x-auto), so the page layout never overflows.
    const { container } = renderWithProviders(<MethodologyPage />);

    const scroll = screen.getByTestId('arch-scroll');
    expect(scroll).toBeInTheDocument();
    expect(scroll.className).toContain('overflow-x-auto');
    expect(scroll.className).toContain('max-w-full');
    expect(scroll.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('#cloud-architecture')).not.toBeNull();
  });

  it('renders the cloud-architecture section for an unauthenticated visitor (req 1.2)', () => {
    // Coverage gap: public / no-login access. renderWithProviders wraps the
    // page with NO auth/login provider, so a successful render proves the page
    // and its cloud-architecture section are reachable without authentication.
    const { container } = renderWithProviders(<MethodologyPage />);

    // No auth context is needed — the section renders for an anonymous visitor.
    expect(container.querySelector('#cloud-architecture')).not.toBeNull();
    expect(screen.getByText('雲端架構關係圖')).toBeInTheDocument();
  });

  it('shows the default view traffic node label on initial page render (req 1.1)', () => {
    // Coverage gap: the diagram's default-view content is visible immediately
    // when the page loads (no interaction required).
    renderWithProviders(<MethodologyPage />);

    expect(screen.getByText('Cloudflare Worker')).toBeInTheDocument();
  });
});
