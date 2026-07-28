import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { HandoffMinimalItem } from './types';

/**
 * Requirement 3.3: HandoffMinimalItem's field-level class-validator decorators
 * must genuinely reject/accept at runtime -- these tests prove the decorators
 * are wired correctly in THIS repo's tsconfig/vitest setup (experimentalDecorators
 * must be honored by the esbuild-based vitest transform), not just that the
 * type shape compiles.
 */
describe('HandoffMinimalItem validation', () => {
  const validPlain = {
    url: 'https://www.104.com.tw/job/abcde',
    title: '後端工程師',
    location: '台北市信義區',
    companyName: '某某科技',
    companyId: 'xyz',
    companyLink: 'https://www.104.com.tw/company/xyz',
    tags: ['Node.js', 'TypeScript'],
  };

  it('passes validation with zero errors when fully populated and valid', async () => {
    const instance = plainToInstance(HandoffMinimalItem, validPlain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('passes validation when optional fields (companyId/companyLink/tags) are omitted', async () => {
    const { companyId, companyLink, tags, ...requiredOnly } = validPlain;
    const instance = plainToInstance(HandoffMinimalItem, requiredOnly);
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('rejects a url that is not a valid URL', async () => {
    const instance = plainToInstance(HandoffMinimalItem, {
      ...validPlain,
      url: 'not-a-url',
    });
    const errors = await validate(instance);
    const urlError = errors.find(error => error.property === 'url');
    expect(urlError).toBeDefined();
    expect(urlError?.constraints).toHaveProperty('isUrl');
  });

  it('rejects an empty title', async () => {
    const instance = plainToInstance(HandoffMinimalItem, {
      ...validPlain,
      title: '',
    });
    const errors = await validate(instance);
    const titleError = errors.find(error => error.property === 'title');
    expect(titleError).toBeDefined();
    expect(titleError?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects an empty location', async () => {
    const instance = plainToInstance(HandoffMinimalItem, {
      ...validPlain,
      location: '',
    });
    const errors = await validate(instance);
    const locationError = errors.find(error => error.property === 'location');
    expect(locationError).toBeDefined();
    expect(locationError?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects an empty companyName', async () => {
    const instance = plainToInstance(HandoffMinimalItem, {
      ...validPlain,
      companyName: '',
    });
    const errors = await validate(instance);
    const companyNameError = errors.find(
      error => error.property === 'companyName',
    );
    expect(companyNameError).toBeDefined();
    expect(companyNameError?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects a non-URL companyLink when provided', async () => {
    const instance = plainToInstance(HandoffMinimalItem, {
      ...validPlain,
      companyLink: 'not-a-url',
    });
    const errors = await validate(instance);
    const companyLinkError = errors.find(
      error => error.property === 'companyLink',
    );
    expect(companyLinkError).toBeDefined();
    expect(companyLinkError?.constraints).toHaveProperty('isUrl');
  });

  it('rejects tags that are not an array of strings', async () => {
    const instance = plainToInstance(HandoffMinimalItem, {
      ...validPlain,
      tags: [1, 2, 3],
    });
    const errors = await validate(instance);
    const tagsError = errors.find(error => error.property === 'tags');
    expect(tagsError).toBeDefined();
    expect(tagsError?.constraints).toHaveProperty('isString');
  });
});
