import { Inject, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { Observable } from 'rxjs';

import {
  JobPreferenceService,
  MvLocationGroupService,
  MvJobService,
  getJobPreferenceCount,
} from '@codeshore/data-utils';
import {
  CacheService,
  Cacheable,
} from '@codeshore/service-cache';

import { QueryDto } from '../query.dto';

const PREFERENCE_COUNT_TTL = 60 * 1000; // 60 seconds

@Injectable()
export class Service {
  constructor(
    @Inject(CacheService) private readonly cacheService: CacheService,
    @Inject(JobPreferenceService)
    private readonly jobPreferenceService: JobPreferenceService,
    @Inject(MvLocationGroupService)
    private readonly mvLocationGroupService: MvLocationGroupService,
    @Inject(MvJobService) private readonly mvJobService: MvJobService,
  ) {}

  async getMvJobs(query: QueryDto, userId: string | null) {
    return this.mvJobService.fetchMvJobsByUserAndPreference(query, userId);
  }

  @Cacheable({ key: MvLocationGroupService.name })
  async getLocationGroups(query: QueryDto) {
    return this.mvLocationGroupService.fetch(query);
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
  ) {
    const result = await this.jobPreferenceService.upsert([
      { job_id: jobId, preference, user_id: userId },
    ]);
    await this.cacheService.invalidate(
      `job-preference-count:${userId}`,
    );
    return result;
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
