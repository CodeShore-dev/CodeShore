import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { Observable } from 'rxjs';

import {
  JobPreferenceService,
  MvLocationGroupService,
  MvLocationSalaryService,
  MvLocationTechService,
  MvJobService,
  getJobPreferenceCount,
  getJobPreferenceReasonCounts,
} from '@codeshore/data-utils';
import type { SupabaseFunction } from '@codeshore/data-types';
import {
  DEFAULT_PREFERENCE_REASON,
  MAX_PREFERENCE_REASON_LENGTH,
  isDefaultReason,
  normalizeReason,
} from '@codeshore/shared-utils';
import {
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import { QueryDto } from '../query.dto';

const PREFERENCE_COUNT_TTL = 60 * 1000; // 60 seconds

/** One in-use reason (sub-category) and how many jobs carry it. */
export type ReasonCount = SupabaseFunction.JobPreferenceReasonCount;

type ReasonPreference = 'like' | 'dislike';

function assertReasonPreference(
  preference: string,
): asserts preference is ReasonPreference {
  if (preference !== 'like' && preference !== 'dislike') {
    throw new BadRequestException(
      'preference must be either "like" or "dislike"',
    );
  }
}

@Injectable()
export class Service {
  constructor(
    @Inject(CacheService) private readonly cacheService: CacheService,
    @Inject(JobPreferenceService)
    private readonly jobPreferenceService: JobPreferenceService,
    @Inject(MvLocationGroupService)
    private readonly mvLocationGroupService: MvLocationGroupService,
    @Inject(MvJobService) private readonly mvJobService: MvJobService,
    @Inject(MvLocationTechService)
    private readonly mvLocationTechService: MvLocationTechService,
    @Inject(MvLocationSalaryService)
    private readonly mvLocationSalaryService: MvLocationSalaryService,
  ) {}

  async getMvJobs(query: QueryDto, userId: string | null) {
    return this.mvJobService.fetchMvJobsByUserAndPreference(query, userId);
  }

  @Cacheable({ key: MvLocationGroupService.name, backend: 'redis' })
  async getLocationGroups(query: QueryDto) {
    return this.mvLocationGroupService.fetch(query);
  }

  async getLocationTechStats(query: QueryDto) {
    return this.mvLocationTechService.fetchAll(query);
  }

  async getLocationSalaryStats(query: QueryDto) {
    return this.mvLocationSalaryService.fetchAll(query);
  }

  async getJobPreferencedCount(userId: string) {
    return this.cacheService.getOrSet(
      `job-preference-count:${userId}`,
      () => getJobPreferenceCount(userId),
      { ttl: PREFERENCE_COUNT_TTL },
    );
  }

  async setJobPreference(
    jobId: string,
    preference: string,
    userId: string,
    reason?: string,
  ) {
    // Always send reason explicitly: upsert does not apply the column
    // default to an existing row, so omitting it would keep a stale reason.
    const result = await this.jobPreferenceService.upsert([
      {
        job_id: jobId,
        preference,
        user_id: userId,
        reason: this.resolveReason(reason),
      },
    ]);
    await this.cacheService.invalidate(
      `job-preference-count:${userId}`,
    );
    return result;
  }

  /**
   * Lists the reasons in use under one preference with their job counts.
   * Not cached (design decision D7): the list must reflect writes at once.
   */
  async getPreferenceReasons(
    preference: string,
    userId: string,
  ): Promise<ReasonCount[]> {
    assertReasonPreference(preference);
    return getJobPreferenceReasonCounts(userId, preference);
  }

  /**
   * Moves every record of this user/preference that uses `reason` back to
   * the default reason. The default reason itself cannot be deleted (400).
   */
  async deletePreferenceReason(
    preference: string,
    reason: string,
    userId: string,
  ): Promise<{ updated: number }> {
    assertReasonPreference(preference);
    const normalized = this.normalizeOrThrow(reason);
    if (isDefaultReason(normalized)) {
      throw new BadRequestException(
        `the default reason "${DEFAULT_PREFERENCE_REASON}" cannot be deleted`,
      );
    }
    const result = await this.jobPreferenceService.resetReason(
      userId,
      preference,
      normalized,
    );
    await this.cacheService.invalidate(
      `job-preference-count:${userId}`,
    );
    return result;
  }

  /**
   * Renames every record of this user/preference that uses `reason` to
   * `name` (D9: only `reason` changes). The default reason cannot be renamed
   * (400); renaming onto an existing name, including the default reason, is
   * a 409 (D10); the same name after trimming is a no-op.
   */
  async renamePreferenceReason(
    preference: string,
    reason: string,
    name: string,
    userId: string,
  ): Promise<{ updated: number }> {
    assertReasonPreference(preference);
    const from = this.normalizeOrThrow(reason);
    if (isDefaultReason(from)) {
      throw new BadRequestException(
        `the default reason "${DEFAULT_PREFERENCE_REASON}" cannot be renamed`,
      );
    }
    const to = this.normalizeOrThrow(name);
    if (from === to) {
      return { updated: 0 };
    }
    if (
      isDefaultReason(to) ||
      (await this.jobPreferenceService.reasonExists(userId, preference, to))
    ) {
      throw new ConflictException(`reason "${to}" already exists`);
    }
    const result = await this.jobPreferenceService.renameReason(
      userId,
      preference,
      from,
      to,
    );
    await this.cacheService.invalidate(
      `job-preference-count:${userId}`,
    );
    return result;
  }

  private resolveReason(reason: string | undefined): string {
    if (reason === undefined) {
      return DEFAULT_PREFERENCE_REASON;
    }
    return this.normalizeOrThrow(reason);
  }

  private normalizeOrThrow(reason: string): string {
    const normalized = normalizeReason(reason);
    if (!normalized.ok) {
      throw new BadRequestException(
        normalized.error === 'empty'
          ? 'reason must not be empty'
          : `reason must be at most ${MAX_PREFERENCE_REASON_LENGTH} characters`,
      );
    }
    return normalized.value;
  }

  async clearJobPreferences(
    preference: string,
    userId: string,
  ) {
    const result =
      await this.jobPreferenceService.deleteByUserAndPreference(
        userId,
        preference,
      );
    await this.cacheService.invalidate(
      `job-preference-count:${userId}`,
    );
    return result;
  }

  spawnCrawlProcessSse(
    id: string,
  ): Observable<MessageEvent> {
    return new Observable(subscriber => {
      const child = spawn(
        'node',
        ['dist/apps/crawler/main.js', `re-crawl=id.eq.${id}`],
        { shell: true, stdio: ['ignore', 'pipe', 'pipe'] },
      );

      const emitLine = (line: string) => {
        subscriber.next({
          data: { type: 'log', message: line },
        } as MessageEvent);
      };

      child.stdout.on('data', (chunk: Buffer) => {
        chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach(emitLine);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach(emitLine);
      });

      child.on('close', code => {
        subscriber.next({
          data: { type: 'done', success: code === 0 },
        } as MessageEvent);
        subscriber.complete();
      });

      child.on('error', err => {
        subscriber.next({
          data: { type: 'error', message: err.message },
        } as MessageEvent);
        subscriber.complete();
      });

      return () => {
        child.kill();
      };
    });
  }
}