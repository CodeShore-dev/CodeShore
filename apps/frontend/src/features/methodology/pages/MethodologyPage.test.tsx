import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';
import { methodologySections } from '../content/sections';
import { MethodologyPage } from './MethodologyPage';

vi.mock('../service', () => ({
  fetchMethodologySql: vi.fn().mockResolvedValue({}),
}));

// TechIcon (used by the embedded diagram) fetches over the network; stub it.
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: () => null,
}));

describe('MethodologyPage', () => {
  it('renders the heading, content sections, and SQL section (req 8.3)', () => {
    renderWithProviders(<MethodologyPage />);

    expect(screen.getByText('公開透明')).toBeInTheDocument();
    expect(screen.getByText('資料來源 SQL')).toBeInTheDocument();
    // First content section title from the reused content module.
    expect(screen.getByText(methodologySections[0].title)).toBeInTheDocument();
  });

  it('gives each section an id for hash deep-linking (req 8.2)', () => {
    const { container } = renderWithProviders(<MethodologyPage />);
    expect(container.querySelector(`#${methodologySections[0].id}`)).not.toBeNull();
  });

  it('renders the cloud-architecture section in addition to existing sections (req 1.1, 1.4)', () => {
    const { container } = renderWithProviders(<MethodologyPage />);

    // New cloud-architecture section is present and deep-link reachable.
    expect(container.querySelector('#cloud-architecture')).not.toBeNull();
    expect(screen.getByText('雲端與 CI/CD 架構')).toBeInTheDocument();

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
    expect(screen.getByText('雲端與 CI/CD 架構')).toBeInTheDocument();
  });

  it('shows the default view traffic node label on initial page render (req 1.1)', () => {
    // Coverage gap: the diagram's default-view content is visible immediately
    // when the page loads (no interaction required).
    renderWithProviders(<MethodologyPage />);

    // The node appears as an interactive button (label also appears in the
    // intro copy, so scope to the diagram node via its button role).
    expect(screen.getByRole('button', { name: 'Cloudflare Worker' })).toBeInTheDocument();
  });

  it('describes the current tech stack in web-tech without stale tech mentions (req 1.1, 1.2)', () => {
    // Coverage gap: the web-tech section must reflect the real, current stack
    // (React/NestJS/Supabase/Crawlee) and must not retain discontinued tech
    // descriptions (Vue, Vue Router, Pinia, VueUse) anywhere in its rendered text.
    const { container } = renderWithProviders(<MethodologyPage />);

    const webTechSection = container.querySelector('#web-tech');
    expect(webTechSection).not.toBeNull();
    const webTechText = webTechSection?.textContent ?? '';

    // Must NOT contain any discontinued tech mentions.
    expect(webTechText).not.toMatch(/Vue/);
    expect(webTechText).not.toMatch(/Pinia/);

    // Must contain current-stack terms.
    expect(webTechText).toMatch(/React/);
  });

  it('renders the dev-methodology section as an independent, deep-linkable topic (req 2.1, 2.2)', () => {
    // Coverage gap: a new "開發方法論" section must exist, be reachable via its
    // own #dev-methodology anchor, and render distinctly from #web-tech.
    const { container } = renderWithProviders(<MethodologyPage />);

    expect(container.querySelector('#dev-methodology')).not.toBeNull();
    expect(screen.getByText('開發方法論')).toBeInTheDocument();
  });

  it('renders the dev-methodology section for an unauthenticated visitor (req 2.3)', () => {
    // Coverage gap: public / no-login access. renderWithProviders wraps the
    // page with NO auth/login provider, so a successful render proves the new
    // dev-methodology section is reachable without authentication.
    const { container } = renderWithProviders(<MethodologyPage />);

    expect(container.querySelector('#dev-methodology')).not.toBeNull();
    expect(screen.getByText('開發方法論')).toBeInTheDocument();
  });

  it('keeps all five existing section anchors present after the web-tech and dev-methodology content changes (req 5.2)', () => {
    // Regression: rewriting web-tech and adding dev-methodology must be
    // additive only — none of the pre-existing anchors may be removed.
    const { container } = renderWithProviders(<MethodologyPage />);

    expect(container.querySelector('#web-tech')).not.toBeNull();
    expect(container.querySelector('#cloud-performance')).not.toBeNull();
    expect(container.querySelector('#data-crawler')).not.toBeNull();
    expect(container.querySelector('#cloud-architecture')).not.toBeNull();
    expect(container.querySelector('#source-sql')).not.toBeNull();
  });

  it('renders at least one improvement row in the dev-methodology table (req 4.2)', () => {
    // Coverage gap: the dev-methodology section must disclose at least one
    // concrete, completed architecture improvement via its table's data rows.
    const { container } = renderWithProviders(<MethodologyPage />);

    const devMethodologySection = container.querySelector('#dev-methodology');
    expect(devMethodologySection).not.toBeNull();

    const rows = devMethodologySection?.querySelectorAll('table tbody tr') ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
