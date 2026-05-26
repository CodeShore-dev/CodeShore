import { Page } from 'puppeteer';

export function setPageIndex(
  url: string,
  pageIndex: number,
) {
  const urlObject = new URL(url);
  urlObject.searchParams.set('page', pageIndex.toString());
  return urlObject.toString();
}

export function getPageIndex(url: string) {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('page');
}

export function generateNextUrlToEnqueue(url: string) {
  const urlsToEnqueue = [];
  const nextUrl = new URL(url);
  const page = parseInt(getPageIndex(url) || '1');
  nextUrl.searchParams.set('page', (page + 1).toString());
  urlsToEnqueue.push(nextUrl.toString());
  return urlsToEnqueue;
}

export function getIdFromUrl(url: string) {
  const urlObj = new URL(url);
  return urlObj.pathname
    .split('/')
    .filter(Boolean)
    .slice(-1)[0];
}

export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else if (seconds > 0) {
    return `${seconds}s ${ms % 1000}ms`;
  }
  return `${ms}ms`;
};

/** Wait a random number of milliseconds in [min, max]. */
export function randomDelay(
  min = 1500,
  max = 4000,
): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise(resolve => setTimeout(resolve, ms));
}

const VIEW_PORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
];

export function randomViewport() {
  return VIEW_PORTS[
    Math.floor(Math.random() * VIEW_PORTS.length)
  ];
}

/** Slowly scroll down ~60 % of the page to mimic a human skimming content. */
export async function humanScroll(
  page: Page,
): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        const target = document.body.scrollHeight * 0.6;
        let scrolled = 0;

        function step() {
          const amount =
            Math.floor(Math.random() * 200) + 80;
          window.scrollBy(0, amount);
          scrolled += amount;
          if (scrolled < target) {
            setTimeout(
              step,
              Math.floor(Math.random() * 150) + 50,
            );
          } else {
            resolve();
          }
        }

        setTimeout(
          step,
          Math.floor(Math.random() * 300) + 100,
        );
      }),
  );
}
