import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

// Mock env so tests are deterministic and siteUrl is known.
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

import { PageSeo } from './PageSeo';

function renderSeo(
  props: Parameters<typeof PageSeo>[0],
  route = '/',
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PageSeo {...props} />
    </MemoryRouter>,
  );
}

describe('PageSeo', () => {
  it('appends site name suffix to title (req 1.1)', () => {
    renderSeo({ title: '職缺瀏覽', description: '瀏覽職缺' });
    expect(document.title).toBe('職缺瀏覽 | 碼的 上岸了');
  });

  it('sets meta description (req 1.3)', () => {
    renderSeo({ title: '首頁', description: '探索技術趨勢' });
    const meta = document.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('探索技術趨勢');
  });

  it('uses explicit canonical when provided (req 2.3)', () => {
    renderSeo(
      { title: '首頁', description: 'desc', canonical: 'https://codeshore.dev/jobs' },
      '/other',
    );
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://codeshore.dev/jobs');
  });

  it('auto-derives canonical from siteUrl + pathname when not provided (req 2.3)', () => {
    renderSeo({ title: '職缺', description: 'desc' }, '/jobs');
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://codeshore.dev/jobs');
  });

  it('auto-derived canonical excludes search query string (req 2.3)', () => {
    renderSeo({ title: '職缺', description: 'desc' }, '/jobs?tags=react');
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://codeshore.dev/jobs');
  });

  it('renders hreflang zh-TW pointing to resolvedCanonical (req 2.2)', () => {
    renderSeo({ title: '首頁', description: 'desc' }, '/');
    const hreflang = document.querySelector('link[hreflang="zh-TW"]');
    expect(hreflang?.getAttribute('href')).toBe('https://codeshore.dev/');
  });

  it('renders hreflang x-default pointing to siteUrl + "/" (req 2.2)', () => {
    renderSeo({ title: '首頁', description: 'desc', canonical: 'https://codeshore.dev/jobs' }, '/jobs');
    const xdefault = document.querySelector('link[hreflang="x-default"]');
    expect(xdefault?.getAttribute('href')).toBe('https://codeshore.dev/');
  });

  it('renders OG tags with correct values (req 3.1)', () => {
    renderSeo({ title: '技術排行', description: 'top techs', canonical: 'https://codeshore.dev/techs' });
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('技術排行 | 碼的 上岸了');
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('top techs');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://codeshore.dev/techs');
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website');
  });

  it('uses default og:image when ogImage not provided (req 3.2)', () => {
    renderSeo({ title: '首頁', description: 'desc' });
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://codeshore.dev/og-image.png',
    );
  });

  it('uses provided ogImage (req 3.2)', () => {
    renderSeo({
      title: '首頁',
      description: 'desc',
      ogImage: 'https://codeshore.dev/custom.png',
    });
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://codeshore.dev/custom.png',
    );
  });

  it('renders Twitter Card tags (req 3.3)', () => {
    renderSeo({ title: 'TW', description: 'twitter desc' });
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe('TW | 碼的 上岸了');
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe('twitter desc');
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
      'https://codeshore.dev/og-image.png',
    );
  });

  it('adds robots noindex,nofollow when noIndex is true (req 2.1)', () => {
    renderSeo({ title: '管理', description: 'admin', noIndex: true });
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots).not.toBeNull();
    expect(robots?.getAttribute('content')).toBe('noindex,nofollow');
  });

  it('does not render robots meta when noIndex is false (req 2.1)', () => {
    renderSeo({ title: '首頁', description: 'desc', noIndex: false });
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots).toBeNull();
  });

  it('does not render robots meta when noIndex is omitted (req 2.1)', () => {
    renderSeo({ title: '首頁', description: 'desc' });
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots).toBeNull();
  });
});
