import type { PuppeteerCrawlingContext } from 'crawlee';
import type { Page } from 'puppeteer';

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

async function clickDropdownButton(page: Page, buttonText: string): Promise<void> {
  await page.evaluate((text: string) => {
    const btn = [...document.querySelectorAll('button[class*="DropdownButton"]')]
      .find(b => b.textContent?.trim() === text);
    (btn as HTMLElement | undefined)?.click();
  }, buttonText);
}

async function clickLocationCity(page: Page, cityText: string): Promise<void> {
  await page.evaluate((city: string) => {
    const items = [...document.querySelectorAll('[class*="TranslatedFacetList"][class*="__list"] > [class*="__item"]')];
    const target = items.find(item => {
      const style = item.getAttribute('style') ?? '';
      const isCityLevel = style.includes('padding-left') && style.includes('32px');
      const text = item.querySelector('[class*="__text"]')?.textContent?.trim();
      return isCityLevel && text === city;
    });
    (target as HTMLElement | undefined)?.click();
  }, cityText);
}

/**
 * 點選 Cake.me 篩選條件:地點(台北市、新北市)與職務類別(軟體 > 全選)。
 * 由 `interceptListResponse` 在架設回應監聽器之前呼叫(`prepareListPage`),
 * 確保篩選過程產生的中間 API 回應不會被監聽器提早捕捉到。
 * 若 URL 已包含 `/for-it` 與 `locations=`,表示篩選條件已套用,直接返回。
 */
export async function applySearchFilters(page: Page): Promise<void> {
  const url = page.url();
  if (url.includes('/for-it') && url.includes('locations=')) return;

  await clickDropdownButton(page, '地點');
  await page.waitForSelector('[class*="TranslatedFacetList"][class*="__list"]', { timeout: 5000 });

  await clickLocationCity(page, '台北市');
  await new Promise<void>(r => setTimeout(r, 800));

  await clickLocationCity(page, '新北市');
  await new Promise<void>(r => setTimeout(r, 800));

  await page.keyboard.press('Escape');
  await new Promise<void>(r => setTimeout(r, 200));

  await clickDropdownButton(page, '職務類別');
  await page.waitForSelector('[class*="FacetList"][class*="__categoryList"]', { timeout: 5000 });

  await page.evaluate(() => {
    const cats = [...document.querySelectorAll('[class*="FacetList"][class*="__categoryText"]')];
    const sw = cats.find(el => el.textContent?.trim() === '軟體');
    (sw?.parentElement as HTMLElement | undefined)?.click();
  });
  await page.waitForSelector('[class*="FacetList"][class*="__nestedList"]', { timeout: 3000 }).catch(() => undefined);

  await page.evaluate(() => {
    const texts = [...document.querySelectorAll('[class*="FacetList"][class*="__nestedList"] [class*="Checkbox"][class*="__text"]')];
    const all = texts.find(el => el.textContent?.trim() === '全選');
    (all?.parentElement as HTMLElement | undefined)?.click();
  });

  await page.waitForFunction(
    () => window.location.href.includes('/for-it') && window.location.href.includes('locations='),
    { timeout: 8000 },
  ).catch(() => undefined);
}

/**
 * 點擊 Cake.me 分頁列的「下一頁」按鈕。
 * 回傳 `true` 表示已點擊且存在後續分頁,`false` 表示無下一頁按鈕。
 */
export async function clickNextPageButton(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const btn = document.querySelector(
      'a[class*="Pagination"][class*="__itemNavigation"]:not([class*="__itemDisabled"])',
    ) as HTMLAnchorElement | null;
    if (!btn) return false;
    btn.click();
    return true;
  });
}

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
