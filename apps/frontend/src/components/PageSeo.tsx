import { useLocation } from 'react-router';

import { env } from '../config/env';

/**
 * JSON-LD structured data object shape (defined here for Task 3.2 rendering).
 * The interface is declared now so consumers can type their jsonLd props;
 * rendering of the <script> block is implemented in Task 3.2.
 */
export interface JsonLdObject {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

export interface PageSeoProps {
  /** Page-level title. Site suffix is appended automatically. */
  title: string;
  description: string;
  /** Explicit canonical URL. Defaults to env.siteUrl + location.pathname. */
  canonical?: string;
  /** OG/Twitter image URL. Defaults to env.siteUrl + '/og-image.png'. */
  ogImage?: string;
  /** When true, adds <meta name="robots" content="noindex,nofollow">. */
  noIndex?: boolean;
  /**
   * JSON-LD structured data. Accepted now; rendered in Task 3.2.
   * Type uses JsonLdObject so callers avoid `any`.
   */
  jsonLd?: JsonLdObject | JsonLdObject[];
}

const SITE_NAME = '碼的 上岸了';

/**
 * Core SEO metadata component.
 *
 * Renders React 19 native metadata elements that are automatically hoisted
 * to <head> by the React runtime. Returns a Fragment with no visible DOM.
 */
export function PageSeo({
  title,
  description,
  canonical,
  ogImage,
  noIndex,
}: PageSeoProps) {
  const location = useLocation();

  const fullTitle = `${title} | ${SITE_NAME}`;
  const resolvedCanonical = canonical ?? `${env.siteUrl}${location.pathname}`;
  const resolvedOgImage = ogImage ?? `${env.siteUrl}/og-image.png`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={resolvedCanonical} />
      <link rel="alternate" hrefLang="zh-TW" href={resolvedCanonical} />
      <link rel="alternate" hrefLang="x-default" href={`${env.siteUrl}/`} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:type" content="website" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedOgImage} />

      {/* Robots — only emitted when noIndex is explicitly true */}
      {noIndex === true && (
        <meta name="robots" content="noindex,nofollow" />
      )}
    </>
  );
}
