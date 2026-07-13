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
  description: string,
): DescriptionLine[] {
  return description
    .split('\n')
    .map((content, index) => ({
      lineNo: index + 1,
      content: content.trim(),
    }))
    .filter(line => line.content.length > 0);
}
