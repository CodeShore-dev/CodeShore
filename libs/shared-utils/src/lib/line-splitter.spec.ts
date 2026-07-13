import { splitDescriptionIntoLines } from './line-splitter';

describe('splitDescriptionIntoLines', () => {
  it('splits a multi-line description into per-line records with 1-based lineNo', () => {
    const result = splitDescriptionIntoLines('a\nb\nc');

    expect(result).toEqual([
      { lineNo: 1, content: 'a' },
      { lineNo: 2, content: 'b' },
      { lineNo: 3, content: 'c' },
    ]);
  });

  it('trims each line', () => {
    const result = splitDescriptionIntoLines(
      '  hello world  \n\tfoo bar\t',
    );

    expect(result).toEqual([
      { lineNo: 1, content: 'hello world' },
      { lineNo: 2, content: 'foo bar' },
    ]);
  });

  it('skips lines that are empty after trimming and preserves original line order in lineNo', () => {
    const result = splitDescriptionIntoLines('a\n\nb');

    expect(result).toEqual([
      { lineNo: 1, content: 'a' },
      { lineNo: 3, content: 'b' },
    ]);
  });

  it('skips whitespace-only lines', () => {
    const result = splitDescriptionIntoLines(
      'a\n   \n\t\nb',
    );

    expect(result).toEqual([
      { lineNo: 1, content: 'a' },
      { lineNo: 4, content: 'b' },
    ]);
  });

  it('returns an empty array when the description has no non-blank lines', () => {
    expect(splitDescriptionIntoLines('')).toEqual([]);
    expect(splitDescriptionIntoLines('\n\n  \n')).toEqual([]);
  });

  it('returns a single record for a single-line description', () => {
    expect(splitDescriptionIntoLines('single line')).toEqual([
      { lineNo: 1, content: 'single line' },
    ]);
  });
});
