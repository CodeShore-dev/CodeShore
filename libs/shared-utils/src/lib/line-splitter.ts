import * as cheerio from 'cheerio';
import { stripLinks } from './utils';

export interface DescriptionLine {
  lineNo: number;
  content: string;
}

/**
 * Splits a description into per-line records.
 *
 * Splits on `\n`, trims each line, and skips lines that are empty after
 * trimming (no record is produced for them). `lineNo` reflects the line's
 * position in the original (pre-filter) split, starting at 1, so skipped
 * blank lines are not renumbered around.
 */
export function splitDescriptionIntoLines(
  textOrHtml: string,
): DescriptionLine[] {
  const $ = cheerio.load(textOrHtml);
      $('div, p, li, h1, h2, h3, h4, h5, br').each(
        (_, el) => {
          $(el).append('\n');
        },
      );
  const text = stripLinks($.text());

  return text
    .split(/\r?\n/)
    .map((content, index) => ({
      lineNo: index + 1,
      content: content.trim(),
    }))
    .filter(line => line.content.length > 0);
}
