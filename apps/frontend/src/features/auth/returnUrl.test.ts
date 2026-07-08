import { beforeEach, describe, expect, it } from 'vitest';

import { consumeReturnUrl, setReturnUrl } from './returnUrl';

describe('returnUrl', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores a relative path and reads it back once', () => {
    setReturnUrl('/jobs?tags=react');
    expect(consumeReturnUrl()).toBe('/jobs?tags=react');
  });

  it('clears the stored value after it is read once', () => {
    setReturnUrl('/jobs?tags=react');
    consumeReturnUrl();
    expect(consumeReturnUrl()).toBeNull();
  });

  it('returns null when nothing was ever stored', () => {
    expect(consumeReturnUrl()).toBeNull();
  });

  it('rejects a protocol-relative path starting with //', () => {
    setReturnUrl('//evil.com/phish');
    expect(consumeReturnUrl()).toBeNull();
  });

  it('rejects an absolute URL', () => {
    setReturnUrl('https://evil.com/phish');
    expect(consumeReturnUrl()).toBeNull();
  });

  it('rejects a path with no leading slash', () => {
    setReturnUrl('jobs?tags=react');
    expect(consumeReturnUrl()).toBeNull();
  });
});
