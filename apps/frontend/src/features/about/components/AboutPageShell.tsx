import type { ReactNode } from 'react';

import { PageSeo } from '../../../components/PageSeo';
import { env } from '../../../config/env';

interface AboutPageShellProps {
  /** Page title (without site suffix; PageSeo adds it). */
  title: string;
  /** Page meta description for SEO. */
  description: string;
  /** Breadcrumb trails rendered as JSON-LD. Last entry is the current page. */
  breadcrumb: { name: string; path: string }[];
  /** When true, prevents search-engine indexing (e.g. internal-only pages). */
  noIndex?: boolean;
  children: ReactNode;
}

/**
 * Shared shell for the lightweight "about" pages (開源於 GitHub / 法律聲明 /
 * 聯絡我們) reached from the footer's 關於 section. Provides PageSeo with a
 * BreadcrumbList JSON-LD, the standard page heading, and a centered content
 * column so the three pages stay visually consistent without each reinventing
 * layout.
 */
export function AboutPageShell({ title, description, breadcrumb, noIndex, children }: AboutPageShellProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumb.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${env.siteUrl}${item.path}`,
    })),
  };

  return (
    <div className="w-full">
      <PageSeo title={title} description={description} jsonLd={jsonLd} noIndex={noIndex} />
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-black text-[#001f2a]">{title}</h1>
        <p className="mb-10 text-sm text-[#434653]">{description}</p>
        {children}
      </div>
    </div>
  );
}
