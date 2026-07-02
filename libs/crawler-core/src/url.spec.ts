import { describe, expect, it } from 'vitest';

import {
  generateNextUrlToEnqueue,
  getIdFromUrl,
  getPageIndex,
  setPageIndex,
} from './url';

describe('setPageIndex', () => {
  it('adds a page query param to a URL with no existing page param', () => {
    const result = setPageIndex('https://example.com/jobs', 3);
    expect(result).toBe('https://example.com/jobs?page=3');
  });

  it('overwrites an existing page query param', () => {
    const result = setPageIndex('https://example.com/jobs?page=1', 5);
    expect(result).toBe('https://example.com/jobs?page=5');
  });

  it('preserves other existing query params', () => {
    const result = setPageIndex('https://example.com/jobs?keyword=engineer&page=1', 2);
    expect(result).toBe('https://example.com/jobs?keyword=engineer&page=2');
  });
});

describe('getPageIndex', () => {
  it('reads an existing page query param', () => {
    const result = getPageIndex('https://example.com/jobs?page=7');
    expect(result).toBe('7');
  });

  it('returns null when the page param is absent', () => {
    const result = getPageIndex('https://example.com/jobs');
    expect(result).toBeNull();
  });
});

describe('generateNextUrlToEnqueue', () => {
  it('increments the page from 1 when no page param is present', () => {
    const result = generateNextUrlToEnqueue('https://example.com/jobs');
    expect(result).toEqual(['https://example.com/jobs?page=2']);
  });

  it('increments the page from an explicit page value', () => {
    const result = generateNextUrlToEnqueue('https://example.com/jobs?page=4');
    expect(result).toEqual(['https://example.com/jobs?page=5']);
  });

  it('returns an array containing a single next URL', () => {
    const result = generateNextUrlToEnqueue('https://example.com/jobs?page=1');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe('getIdFromUrl', () => {
  it('derives the last non-empty path segment as the id', () => {
    const result = getIdFromUrl('https://example.com/jobs/12345');
    expect(result).toBe('12345');
  });

  it('handles a trailing slash by skipping the empty segment', () => {
    const result = getIdFromUrl('https://example.com/jobs/12345/');
    expect(result).toBe('12345');
  });

  it('derives the id from a deeper path using the final segment', () => {
    const result = getIdFromUrl('https://example.com/jobs/category/abc-999');
    expect(result).toBe('abc-999');
  });
});
