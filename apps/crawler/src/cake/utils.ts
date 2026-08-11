import type { PuppeteerCrawlingContext } from 'crawlee';

import { JobDetailOnHTML } from './@types';

export const isTheHost = (host: string) =>
  host === 'www.cake.me';

export const CAKE_HOMEPAGE_URL = 'https://www.cake.me/jobs?ref=navs_jobs';

/**
 * 導向清單頁(含分頁)的 job source URL 之前,先造訪 cake.me 首頁——模擬一般
 * 使用者「先進站再點進職缺搜尋頁」的瀏覽路徑,而非直接打搜尋頁網址,藉此降低
 * 被 Cloudflare 判定為爬蟲流量而擋下的機率。只套用在清單頁請求(無
 * `label`),詳情頁請求(`label === 'DETAIL'`)略過,避免每個職缺詳情都重複
 * 繞去首頁,徒增請求量又拖慢爬取速度。
 */
export const createHomepageWarmupHook =
  () =>
  async ({ request, page }: PuppeteerCrawlingContext): Promise<void> => {
    if (request.label === 'DETAIL') return;
    await page.goto(CAKE_HOMEPAGE_URL, { waitUntil: 'domcontentloaded' });
  };

export const waitFordDetailPageSelector =
  '[class^=ContentSection-module-scss-module__][class$=__content]';

export function extractJobDetailOnHTML(): JobDetailOnHTML {
  const descriptionElements = document.querySelectorAll(
    '[class^=ContentSection-module-scss-module__][class$=__content]',
  );
  const description = [...descriptionElements]
    .map(x => x.innerHTML)
    .join('\n')
    .replace(/ +/g, ' ')
    .replace(/\t+/g, '  ')
    .trim();

  const salaryElem = document.querySelector(
    '[class^=JobDescriptionRightColumn-module-scss-module__][class$=__salaryWrapper]',
  );
  const salary = salaryElem
    ? (salaryElem.textContent?.trim() ?? '')
    : '';

  const companyInfoItem = document.querySelector(
    '[class^=CompanyInfoItem-module-scss-module__][class$=__container]',
  );
  const company_type = companyInfoItem
    ? (companyInfoItem.textContent?.trim() ?? '')
    : '';

  const locationElement = document.querySelector(
    "a[href^='https://www.cake.me/jobs?location_list']",
  );
  const location = locationElement
    ? (locationElement.textContent?.trim() ?? '')
    : '';

  return {
    description,
    salary,
    location,
    company_type
  };
}
