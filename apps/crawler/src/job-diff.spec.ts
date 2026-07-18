import { describe, expect, it } from 'vitest';

import { hasJobFieldsChanged } from './job-diff';

describe('job-diff.ts hasJobFieldsChanged', () => {
  it('returns true when only description differs between previous and fresh', () => {
    const previous = {
      title: '資深後端工程師',
      description: '原始職缺描述',
      location: '台北市信義區',
      salary: '月薪 60,000 元以上',
      closed: false,
    };
    const fresh = {
      ...previous,
      description: '更新後的職缺描述',
    };

    expect(hasJobFieldsChanged(previous, fresh)).toBe(true);
  });

  it('returns true when multiple fields differ at once', () => {
    const previous = {
      title: '資深後端工程師',
      description: '原始職缺描述',
      location: '台北市信義區',
      salary: '月薪 60,000 元以上',
      closed: false,
    };
    const fresh = {
      ...previous,
      title: '資深全端工程師',
      location: '台北市大安區',
      salary: '月薪 70,000 元以上',
    };

    expect(hasJobFieldsChanged(previous, fresh)).toBe(true);
  });

  it('returns false when all compared fields are equal', () => {
    const previous = {
      title: '資深後端工程師',
      description: '原始職缺描述',
      location: '台北市信義區',
      salary: '月薪 60,000 元以上',
      closed: false,
    };
    const fresh = { ...previous };

    expect(hasJobFieldsChanged(previous, fresh)).toBe(false);
  });

  it('does not compare a field present in previous but omitted (undefined) from fresh', () => {
    const previous = {
      title: '資深後端工程師',
      salary: '月薪 60,000 元以上',
    };
    // `salary` differs but is omitted from `fresh`, e.g. caller excluding it
    // due to the salary_manual exemption rule (a caller concern, not this
    // function's). It must not affect the result.
    const fresh = {
      title: '資深後端工程師',
    };

    expect(hasJobFieldsChanged(previous, fresh)).toBe(false);
  });

  it('returns false for an empty fresh object (vacuously unchanged)', () => {
    const previous = {
      title: '資深後端工程師',
      description: '原始職缺描述',
      location: '台北市信義區',
      salary: '月薪 60,000 元以上',
      closed: false,
    };
    const fresh = {};

    expect(hasJobFieldsChanged(previous, fresh)).toBe(false);
  });

  it('returns true when the closed boolean field changes from false to true', () => {
    const previous = {
      closed: false,
    };
    const fresh = {
      closed: true,
    };

    expect(hasJobFieldsChanged(previous, fresh)).toBe(true);
  });

  it('returns false when closed is unchanged and no other field is present', () => {
    const previous = {
      closed: true,
    };
    const fresh = {
      closed: true,
    };

    expect(hasJobFieldsChanged(previous, fresh)).toBe(false);
  });
});
