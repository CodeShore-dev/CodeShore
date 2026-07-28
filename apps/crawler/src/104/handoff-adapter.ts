import { getIdFromUrl } from '@codeshore/crawler-core';

import { HandoffMinimalItem } from '../handoff/types';
import { JobOnAPI } from './@types';

/**
 * Converts a degraded-capture `HandoffMinimalItem` (Requirement 2.2) into a
 * 104 `JobOnAPI & {id: string}` shape that the EXISTING, unmodified
 * `cookRawJob`/`buildPersistItem` (`apps/crawler/src/104/formatter.ts`) can
 * consume without any changes (Requirement 4.4, design.md HandoffAdapters).
 *
 * Only the fields `cookRawJob` actually reads are precisely wired from
 * `item`: `link.cust` (used twice -- `company_id = getIdFromUrl(link.cust)`
 * and `company.link = link.cust` verbatim), `jobName` (title),
 * `jobAddrNoDesc` (location), `custName` (company.name), `coIndustryDesc`
 * (company.type), and `link.job` (`detail_link`). `id`/`link.job` are
 * derived from the job's own URL (mirroring how
 * `apps/crawler/src/104/handler.ts`'s `extractItems` sets
 * `id: getIdFromUrl(x.link.job)` for a live-fetched item, and how
 * `transformItem` later recomputes `url: job.link.job`/`title: job.jobName`
 * from this adapter's output -- so those two fields must match the
 * `HandoffMinimalItem.url`/`title` the operator captured). All other
 * `JobOnAPI` fields are required by the type but never read by
 * `cookRawJob`/`buildPersistItem`, so they get type-safe, harmless
 * placeholder defaults.
 *
 * Unlike Cake (where the company slug is derivable from the job detail
 * URL's own path structure), 104's job detail URL does NOT embed the
 * company's URL (design.md Open Questions/Risks: "104 則沒有對應的 URL 結構
 * 可推導、需要 `companyLink` 欄位"). `HandoffMinimalItem.companyLink` is
 * `@IsOptional()` at the shared, host-agnostic schema level, but this
 * adapter enforces it as REQUIRED for 104: a missing `companyLink` throws a
 * descriptive error rather than silently falling back to an empty/fabricated
 * URL, which would corrupt the persisted `company_id`/`company.link`.
 *
 * `HandoffMinimalItem` has no field corresponding to `coIndustryDesc`
 * (company industry/type) -- there is no "company type" concept in the
 * degraded-capture minimum viable dataset -- so `coIndustryDesc` is always
 * an empty-string placeholder here, meaning the persisted `company.type`
 * will always be empty for 104 degraded captures. This is an accepted,
 * documented data-quality tradeoff of degraded capture, not a bug.
 */
export function toRawItemFromMinimal(
  item: HandoffMinimalItem,
): JobOnAPI & { id: string } {
  if (!item.companyLink) {
    throw new Error(
      `toRawItemFromMinimal: HandoffMinimalItem.companyLink is required for 104 degraded captures ` +
        `(unlike Cake, 104's job detail URL does not embed the company's URL, so companyLink cannot be ` +
        `derived) but was missing for url: ${item.url}`,
    );
  }

  const id = getIdFromUrl(item.url);
  const wfPlaceholder = { desc: '', param: '' };
  const pcSkillPlaceholder = { code: '', description: '' };

  const raw: JobOnAPI & { id: string } = {
    id,
    appearDate: '',
    applyCnt: 0,
    coIndustry: 0,
    coIndustryDesc: '',
    custName: item.companyName,
    custNo: '',
    description: '',
    descSnippet: '',
    mrtDist: 0,
    jobAddress: '',
    jobAddrNo: 0,
    jobAddrNoDesc: item.location,
    jobName: item.title,
    jobNameSnippet: '',
    jobNo: '',
    jobRo: 0,
    jobType: 0,
    lat: 0,
    lon: 0,
    link: {
      job: item.url,
      cust: item.companyLink,
      applyAnalyze: '',
    },
    major: [],
    mrt: '',
    mrtDesc: '',
    optionEdu: [],
    period: 0,
    remoteWorkType: 0,
    s10: 0,
    salaryHigh: 0,
    salaryLow: 0,
    tags: {
      wf7: { ...wfPlaceholder },
      wf30: { ...wfPlaceholder },
      wf29: { ...wfPlaceholder },
      wf10: { ...wfPlaceholder },
      wf3: { ...wfPlaceholder },
      wf1: { ...wfPlaceholder },
      wf4: { ...wfPlaceholder },
      wf9: { ...wfPlaceholder },
      landmark: { desc: '' },
    },
    s9: [],
    s5: 0,
    d3: '',
    hrBehaviorPR: 0,
    jobCat: [],
    labels: [],
    languageRequirements: [],
    acceptRole: [],
    employeeCount: 0,
    pcSkills: [
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
      { ...pcSkillPlaceholder },
    ],
    pddScore: 0,
    isSave: null,
    interactionRecord: {
      lastProcessedResumeAtTime: 0,
      lastCustReplyTimestamp: null,
      nowTimestamp: 0,
    },
    isApplied: null,
    applyDate: null,
    userApplyCount: null,
  };

  return raw;
}
