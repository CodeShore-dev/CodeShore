import { describe, expect, it } from 'vitest';

import { DEFAULT_PREFERENCE_REASON } from '@codeshore/shared-utils';

import { buildReasonOptions } from './buildReasonOptions';

describe('buildReasonOptions', () => {
  it('adds the default reason first when the server list lacks it', () => {
    const options = buildReasonOptions(
      [
        { reason: '技能已符合', job_count: 3 },
        { reason: '差一點要補技能經驗', job_count: 1 },
      ],
      [],
    );

    expect(options).toEqual([
      {
        reason: DEFAULT_PREFERENCE_REASON,
        jobCount: 0,
        isDraft: false,
        deletable: false,
      },
      {
        reason: '技能已符合',
        jobCount: 3,
        isDraft: false,
        deletable: true,
      },
      {
        reason: '差一點要補技能經驗',
        jobCount: 1,
        isDraft: false,
        deletable: true,
      },
    ]);
  });

  it('keeps the server-provided default reason count and places it first', () => {
    const options = buildReasonOptions(
      [
        { reason: '技能已符合', job_count: 3 },
        { reason: DEFAULT_PREFERENCE_REASON, job_count: 7 },
      ],
      [],
    );

    expect(options[0]).toEqual({
      reason: DEFAULT_PREFERENCE_REASON,
      jobCount: 7,
      isDraft: false,
      deletable: false,
    });
    expect(options).toHaveLength(2);
  });

  it('sorts non-default items (server + drafts) by localeCompare zh-Hant', () => {
    const options = buildReasonOptions(
      [{ reason: '技能已符合', job_count: 3 }],
      ['差一點要補技能經驗', '面試準備'],
    );

    expect(options.map((o) => o.reason)).toEqual([
      DEFAULT_PREFERENCE_REASON,
      ...['差一點要補技能經驗', '面試準備', '技能已符合'].sort((a, b) =>
        a.localeCompare(b, 'zh-Hant'),
      ),
    ]);
  });

  it('drops a draft that duplicates a server reason name, keeping only the server item', () => {
    const options = buildReasonOptions(
      [{ reason: '技能已符合', job_count: 3 }],
      ['技能已符合'],
    );

    expect(options).toEqual([
      {
        reason: DEFAULT_PREFERENCE_REASON,
        jobCount: 0,
        isDraft: false,
        deletable: false,
      },
      {
        reason: '技能已符合',
        jobCount: 3,
        isDraft: false,
        deletable: true,
      },
    ]);
  });

  it('drops a draft that duplicates the default reason name', () => {
    const options = buildReasonOptions([], [DEFAULT_PREFERENCE_REASON]);

    expect(options).toEqual([
      {
        reason: DEFAULT_PREFERENCE_REASON,
        jobCount: 0,
        isDraft: false,
        deletable: false,
      },
    ]);
  });

  it('collapses duplicate draft names into a single option', () => {
    const options = buildReasonOptions(
      [],
      ['新原因', '新原因', '新原因'],
    );

    expect(options).toEqual([
      {
        reason: DEFAULT_PREFERENCE_REASON,
        jobCount: 0,
        isDraft: false,
        deletable: false,
      },
      {
        reason: '新原因',
        jobCount: 0,
        isDraft: true,
        deletable: true,
      },
    ]);
  });

  it('marks draft items as isDraft true, jobCount 0, deletable true', () => {
    const options = buildReasonOptions([], ['新原因']);

    expect(options[1]).toEqual({
      reason: '新原因',
      jobCount: 0,
      isDraft: true,
      deletable: true,
    });
  });

  it('marks server items as isDraft false and deletable true (non-default)', () => {
    const options = buildReasonOptions(
      [{ reason: '技能已符合', job_count: 5 }],
      [],
    );

    expect(options[1]).toEqual({
      reason: '技能已符合',
      jobCount: 5,
      isDraft: false,
      deletable: true,
    });
  });

  it('marks the default reason as deletable false always', () => {
    const options = buildReasonOptions(
      [{ reason: DEFAULT_PREFERENCE_REASON, job_count: 2 }],
      [DEFAULT_PREFERENCE_REASON],
    );

    expect(options).toEqual([
      {
        reason: DEFAULT_PREFERENCE_REASON,
        jobCount: 2,
        isDraft: false,
        deletable: false,
      },
    ]);
  });

  it('returns only the default reason when both inputs are empty', () => {
    const options = buildReasonOptions([], []);

    expect(options).toEqual([
      {
        reason: DEFAULT_PREFERENCE_REASON,
        jobCount: 0,
        isDraft: false,
        deletable: false,
      },
    ]);
  });
});
