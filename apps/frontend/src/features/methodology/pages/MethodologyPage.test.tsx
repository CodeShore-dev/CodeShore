import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScrollManager } from '../../../app/ScrollManager';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { methodologySections } from '../content/sections';
import { MethodologyPage } from './MethodologyPage';

vi.mock('../service', () => ({
  fetchMethodologySql: vi.fn().mockResolvedValue({}),
  // Minimal but shape-accurate AiWorkflowsResponse so AiWorkflowsSection (now
  // mounted on this page) resolves to real content instead of erroring on an
  // undefined mock — mirrors AiWorkflowsSection.test.tsx's own MOCK_RESPONSE.
  fetchAiWorkflows: vi.fn().mockResolvedValue({
    aiSuggestion: [
      {
        workflow: 'keyword_mapping',
        label: '關鍵字對應技術',
        steps: [
          {
            stepLabel: '關鍵字→技術映射',
            toolName: 'classify_keyword_to_tech',
            systemPrompt: 'system prompt for keyword mapping',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    ],
    keywordCuration: {
      toolName: 'classify_keyword',
      systemPrompt: 'system prompt for classifier',
      inputSchema: { type: 'object', properties: {} },
      paths: [
        { path: 'A', label: '路徑 A：映射至既有技術條目' },
        { path: 'B', label: '路徑 B：建立新技術條目' },
        { path: 'C', label: '路徑 C：移入 keyword bin' },
      ],
    },
  }),
}));

// TechIcon (used by the embedded diagram) fetches over the network; stub it.
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: () => null,
}));

describe('MethodologyPage SEO (req 2.1, 2.2, 2.3, 3.1, 3.2, 5.3)', () => {
  it('sets the document title with the site suffix (req 2.1)', () => {
    renderWithProviders(<MethodologyPage />, { route: '/methodology' });
    expect(document.title).toBe('分析方法論與透明度 | 碼的 上岸了');
  });

  it('renders a BreadcrumbList JSON-LD pointing at home and the methodology page (req 5.3)', () => {
    const { container } = renderWithProviders(<MethodologyPage />, {
      route: '/methodology',
    });
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();

    const parsed = JSON.parse(script?.innerHTML ?? '');
    expect(parsed).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首頁',
          item: 'https://codeshore.dev/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '公開透明',
          item: 'https://codeshore.dev/methodology',
        },
      ],
    });
  });
});

describe('MethodologyPage', () => {
  it('renders the heading, content sections, and SQL section (req 8.3)', () => {
    renderWithProviders(<MethodologyPage />);

    expect(screen.getByText('公開透明')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '資料來源 SQL' })).toBeInTheDocument();
    // First content section title from the reused content module.
    expect(
      screen.getByRole('heading', { name: methodologySections[0].title }),
    ).toBeInTheDocument();
  });

  it('gives each section an id for hash deep-linking (req 8.2)', () => {
    const { container } = renderWithProviders(<MethodologyPage />);
    expect(container.querySelector(`#${methodologySections[0].id}`)).not.toBeNull();
  });

  it('renders the cloud-architecture section in addition to existing sections (req 1.1, 1.4)', () => {
    const { container } = renderWithProviders(<MethodologyPage />);

    // New cloud-architecture section is present and deep-link reachable.
    expect(container.querySelector('#cloud-architecture')).not.toBeNull();
    expect(screen.getByRole('heading', { name: '雲端與 CI/CD 架構' })).toBeInTheDocument();

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
    expect(screen.getByRole('heading', { name: '雲端與 CI/CD 架構' })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: '開發方法論' })).toBeInTheDocument();
  });

  it('renders the dev-methodology section for an unauthenticated visitor (req 2.3)', () => {
    // Coverage gap: public / no-login access. renderWithProviders wraps the
    // page with NO auth/login provider, so a successful render proves the new
    // dev-methodology section is reachable without authentication.
    const { container } = renderWithProviders(<MethodologyPage />);

    expect(container.querySelector('#dev-methodology')).not.toBeNull();
    expect(screen.getByRole('heading', { name: '開發方法論' })).toBeInTheDocument();
  });

  it('keeps all six existing section anchors present after the web-tech, dev-methodology, and ai-workflows content changes (req 5.2)', () => {
    // Regression: rewriting web-tech, adding dev-methodology, and mounting
    // ai-workflows must all be additive only — none of the pre-existing
    // anchors may be removed.
    const { container } = renderWithProviders(<MethodologyPage />);

    expect(container.querySelector('#web-tech')).not.toBeNull();
    expect(container.querySelector('#cloud-performance')).not.toBeNull();
    expect(container.querySelector('#data-crawler')).not.toBeNull();
    expect(container.querySelector('#cloud-architecture')).not.toBeNull();
    expect(container.querySelector('#source-sql')).not.toBeNull();
    expect(container.querySelector('#ai-workflows')).not.toBeNull();
  });

  it('renders the ai-workflows section mounted after database and before the dynamic content sections (req 1.1)', () => {
    // New「AI 應用與工作流程」section (task 4.1's AiWorkflowsSection) must be
    // wired into this page: present, titled, and positioned right after
    // DatabaseSchemaSection (#database) and before the methodologySections
    // dynamic block, per design.md's mount-point spec.
    const { container } = renderWithProviders(<MethodologyPage />);

    expect(container.querySelector('#ai-workflows')).not.toBeNull();
    expect(
      screen.getByRole('heading', { name: 'AI 應用與工作流程' }),
    ).toBeInTheDocument();

    const databaseSection = container.querySelector('#database');
    expect(databaseSection?.nextElementSibling?.id).toBe('ai-workflows');
  });

  it('scrolls to the ai-workflows section when navigating to its hash anchor, consistent with other sections (req 1.2)', async () => {
    // Requirement 1.2: the new section's deep-link behavior must be
    // identical to every other section's — this page reuses the existing
    // hash-scroll mechanism (ScrollManager) rather than any new logic, so
    // this mirrors ScrollManager.test.tsx's own verification technique
    // (spy on window.scrollTo, click a hash link, assert the offset call)
    // instead of inventing a new one.
    const user = userEvent.setup();
    const scrollSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);

    renderWithProviders(
      <>
        <ScrollManager />
        <MethodologyPage />
      </>,
      { route: '/methodology' },
    );
    scrollSpy.mockClear(); // ignore the initial-mount scroll

    await user.click(screen.getByRole('link', { name: 'AI 應用與工作流程' }));

    // jsdom reports 0 for getBoundingClientRect()/scrollY, so the computed
    // target is 0 + 0 - 80 (ScrollManager's HASH_OFFSET) — the same formula
    // ScrollManager.test.tsx asserts for every other section's hash link.
    expect(scrollSpy).toHaveBeenCalledWith({ top: -80 });

    scrollSpy.mockRestore();
  });

  it('renders the ai-workflows section fully for an unauthenticated visitor (req 1.3)', async () => {
    // Coverage gap: public / no-login access. renderWithProviders wraps the
    // page with NO auth/login provider, so a successful full render —
    // including fetched workflow content, not just the empty section shell —
    // proves the new section is reachable without authentication.
    renderWithProviders(<MethodologyPage />);

    expect(
      screen.getByRole('heading', { name: 'AI 應用與工作流程' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('關鍵字對應技術')).toBeInTheDocument();
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
