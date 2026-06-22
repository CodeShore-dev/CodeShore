import { describe, expect, it } from 'vitest';

import { computeCanEdit } from './authStore';

// Requirement 2.4: admin-only edit permission derivation.
describe('computeCanEdit', () => {
  it('returns false when there is no user', () => {
    expect(computeCanEdit(null, ['admin@codeshore.dev'])).toBe(false);
  });

  it('allows any signed-in user when no admin allowlist is configured', () => {
    expect(computeCanEdit({ email: 'anyone@x.com' }, [])).toBe(true);
  });

  it('allows a user whose email is on the allowlist', () => {
    expect(
      computeCanEdit({ email: 'admin@codeshore.dev' }, [
        'admin@codeshore.dev',
        'other@codeshore.dev',
      ]),
    ).toBe(true);
  });

  it('denies a user whose email is not on the allowlist', () => {
    expect(
      computeCanEdit({ email: 'nope@x.com' }, ['admin@codeshore.dev']),
    ).toBe(false);
  });

  it('denies a user with no email against a non-empty allowlist', () => {
    expect(
      computeCanEdit({ email: undefined }, ['admin@codeshore.dev']),
    ).toBe(false);
  });
});
