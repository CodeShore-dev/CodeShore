import { HandoffMinimalItem } from '../handoff/types';
import { JobOnAPI } from './@types';

/**
 * Converts a degraded-capture `HandoffMinimalItem` (Requirement 2.2) into a
 * Cake `JobOnAPI & {id: string}` shape that the EXISTING, unmodified
 * `cookRawJob`/`buildPersistItem` (`apps/crawler/src/cake/formatter.ts`) can
 * consume without any changes (Requirement 4.4, design.md HandoffAdapters).
 *
 * Only the fields `cookRawJob` actually reads are precisely wired from
 * `item`: `page.geo.region_l` (location), `page.path` (company_id),
 * `page.name` (company.name), `tags` (Tags-append in description), `title`.
 * `id`/`path` are derived from the job's own URL-embedded slug (mirroring
 * how `apps/crawler/src/cake/handler.ts`'s `extractItems` sets `id: x.path`
 * for a live-fetched item). All other `JobOnAPI` fields are required by the
 * type but never read by `cookRawJob`/`buildPersistItem`, so they get
 * type-safe, harmless placeholder defaults (see design.md's Open Questions
 * note on enumerating `JobOnAPI`'s full required-field set).
 *
 * Cake detail URLs follow `https://www.cake.me/companies/{companyPath}/jobs/
 * {jobPath}` (confirmed against `cake/handler.ts`'s `transformItem`, which
 * reconstructs this exact same URL from `job.page.path`/`job.path`). This
 * adapter parses `item.url`'s pathname to recover `companyPath`/`jobPath`,
 * so that the URL `transformItem` later recomputes from this adapter's
 * output matches the `HandoffMinimalItem.url` the operator captured. Per
 * `HandoffMinimalItem`'s own doc comment, Cake capture may omit
 * `companyId` (it's derivable from the URL); when provided, it wins over the
 * URL-derived value. A URL that doesn't match the expected structure is
 * treated as an ingestion-time error (thrown, not silently patched around),
 * since a bad `id`/`page.path` here would silently corrupt persisted data.
 */
export function toRawItemFromMinimal(
  item: HandoffMinimalItem,
): JobOnAPI & { id: string } {
  const { companyPath: companyPathFromUrl, jobPath } =
    parseCakeJobUrl(item.url);
  const companyPath = item.companyId ?? companyPathFromUrl;
  const tags = item.tags ?? [];

  const raw: JobOnAPI & { id: string } = {
    id: jobPath,
    path: jobPath,
    title: item.title,
    highlighted_title: '',
    description: '',
    highlighted_description: '',
    locations: [],
    locations_with_locale: [],
    salary: {
      min: '',
      max: '',
      currency: '',
      type: '',
    },
    seniority_level: '',
    job_type: '',
    inclusivity_traits: [],
    number_of_management: '',
    number_of_openings: 0,
    tags,
    page: {
      path: companyPath,
      name: item.companyName,
      highlighted_name: '',
      logo: '',
      country: '',
      geo: {
        region_l: item.location,
        city: '',
        state_name: '',
        zip: '',
        street_address: '',
      },
    },
    unique_impressions_count: 0,
    lang_name: '',
    min_work_exp_year: 0,
    content_updated_at: '',
  };

  return raw;
}

/**
 * Parses `https://www.cake.me/companies/{companyPath}/jobs/{jobPath}` (any
 * host, matching `transformItem`'s reconstruction pattern) into its two
 * URL-embedded slugs. Throws a descriptive error for anything that doesn't
 * match this exact 4-segment shape, rather than silently deriving an
 * empty/wrong `id`/`page.path`.
 */
function parseCakeJobUrl(url: string): {
  companyPath: string;
  jobPath: string;
} {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    throw new Error(
      `toRawItemFromMinimal: HandoffMinimalItem.url is not a valid URL: ${url}`,
    );
  }

  const segments = pathname.split('/').filter(Boolean);
  const isValidCakeJobUrl =
    segments.length === 4 &&
    segments[0] === 'companies' &&
    segments[2] === 'jobs' &&
    segments[1].length > 0 &&
    segments[3].length > 0;

  if (!isValidCakeJobUrl) {
    throw new Error(
      `toRawItemFromMinimal: HandoffMinimalItem.url does not match the expected cake.me job URL structure ` +
        `"https://www.cake.me/companies/{companyPath}/jobs/{jobPath}": ${url}`,
    );
  }

  return { companyPath: segments[1], jobPath: segments[3] };
}
