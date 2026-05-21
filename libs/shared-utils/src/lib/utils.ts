import * as cheerio from 'cheerio';

function stripLinks(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      '',
    );
}

const STOP_WORDS = new Set([
  'the',
  'is',
  'and',
  'to',
  'in',
  'of',
  'for',
  'a',
  'an',
  'with',
  'on',
]);

export function parseKeywordsOut(
  textOrHtml: string,
  allGroupKeywords: string[] = [],
): {
  keywords: string[];
  description_ch_en_ratio: number;
} {
  let keywords: string[] = [];
  let ratio = 0;
  let isHighlyEnglish = false;

  ({ isHighlyEnglish, ratio } =
    checkHighlyEnglish(textOrHtml));

  if (isHighlyEnglish) {
    keywords = scanKeywordsFromGroups(
      textOrHtml,
      allGroupKeywords,
    );
  } else if (textOrHtml) {
    const $ = cheerio.load(textOrHtml);
    $('div, p, li, h1, h2, h3, h4, h5, br').each(
      (_, el) => {
        $(el).append('\n');
      },
    );
    const text = stripLinks($.text());

    if (text) {
      const allCleanWords: string[] = [];
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.replace(/\.+etc/g, '').trim();
        if (!trimmed) continue;

        const rawWords =
          trimmed.match(
            /\.?[a-zA-Z0-9]+(?:[\s\.\-\/]+[a-zA-Z0-9]+)*[#+]*/g,
          ) || [];

        const cleanWords = rawWords
          .flatMap(word =>
            word.split(/\s+(?:or|and|\/|with)\s+/i),
          )
          .flatMap(word => {
            const parts = word.split('/');
            if (
              parts.length > 1 &&
              parts.every(p => p.length >= 3)
            ) {
              return parts;
            }
            return [word];
          })
          .map(word =>
            word
              .toLowerCase()
              .replace(/^(?:(?:or|and|e\.g\.?)\s+)+/g, '')
              .replace(/^[0-9]+[\.\-\s]+/g, '')
              .replace(/(?:\s+(?:or|and|e\.g\.?))+$/g, '')
              .replace(/\s+/g, ' ')
              .trim(),
          )
          .filter(
            word =>
              word.length > 1 &&
              !STOP_WORDS.has(word) &&
              /[a-z]/.test(word),
          );

        allCleanWords.push(...cleanWords);
      }

      keywords = Array.from(new Set(allCleanWords));
    }
  }
  return {
    keywords,
    description_ch_en_ratio: ratio,
  };
}

export function calculateChineseRatio(
  textOrHtml: string,
): number {
  const $ = cheerio.load(textOrHtml);
  const text = $.text();
  const nonWhitespace = text.replace(/\s/g, '');
  if (nonWhitespace.length === 0) return 0;
  const chineseChars = nonWhitespace.match(
    /[\u4e00-\u9fff\u3400-\u4dbf]/g,
  );
  const chineseCount = chineseChars
    ? chineseChars.length
    : 0;
  return chineseCount / nonWhitespace.length;
}

export function checkHighlyEnglish(
  textOrHtml: string,
  threshold = 0.4,
): { isHighlyEnglish: boolean; ratio: number } {
  let ratio = calculateChineseRatio(textOrHtml);
  return { isHighlyEnglish: ratio < threshold, ratio };
}

export function scanKeywordsFromGroups(
  textOrHtml: string,
  allGroupKeywords: string[],
): string[] {
  if (!textOrHtml || allGroupKeywords.length === 0)
    return [];
  const $ = cheerio.load(textOrHtml);
  $('div, p, li, h1, h2, h3, h4, h5, br').each((_, el) => {
    $(el).append('\n');
  });
  const text = stripLinks($.text());
  if (!text) return [];
  return allGroupKeywords.filter(keyword => {
    const escaped = keyword.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    return new RegExp(
      `(?<![\\w-])${escaped}(?![\\w-]|(\\.$)\\w)`,
      'i',
    ).test(text);
  });
}

export function parseSalary(input: string) {
  let ratio = 1;
  if (input.includes('JPY')) {
    ratio = 0.2;
  } else if (input.includes('USD')) ratio = 31;
  const cleanStr = input.replace(/,/g, '');
  const numbers =
    cleanStr
      .match(/\d+/g)
      ?.map(Number)
      .map(x => x * ratio) || [];
  const salary_type: 'month' | 'year' = cleanStr.includes(
    '年',
  )
    ? 'year'
    : 'month';

  let min_salary = 0;
  let max_salary = 9999999;

  if (numbers.length === 2) {
    [min_salary, max_salary] = numbers;
  } else if (numbers.length === 1) {
    min_salary = numbers[0];
    max_salary = 9999999;
  } else if (cleanStr.includes('面議')) {
    min_salary = 0;
    max_salary = 9999999;
  }

  return { min_salary, max_salary, salary_type };
}
