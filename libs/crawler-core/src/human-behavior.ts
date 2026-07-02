import { Page } from 'puppeteer';

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
