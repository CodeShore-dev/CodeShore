import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { Observable } from 'rxjs';

import {
  upsertJobPreference,
  fetchMvJobs,
  fetchMvLocationGroup,
  getJobPreferenceCount,
} from '@codeshore/data-utils';
import { Cacheable, CacheService } from '@codeshore/service-cache';

import { QueryDto } from '../query.dto';

const PREFERENCE_COUNT_TTL = 60 * 1000; // 60 seconds
const CACHE_KEY_LOCATION_GROUP = 'job:location:groups';

@Injectable()
export class Service {
  constructor(private readonly cacheService: CacheService) {}

  async getJobs(query: QueryDto, userId: string) {
    return fetchMvJobs(query, userId);
  }

  @Cacheable({ key: CACHE_KEY_LOCATION_GROUP })
  async getLocationGroups(query: QueryDto) {
    return fetchMvLocationGroup(query);
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
    const result = await upsertJobPreference(jobId, preference, userId);
    await this.cacheService.invalidate(`job-preference-count:${userId}`);
    return result;
  }

  spawnCrawlProcessSse(
    id: string,
  ): Observable<MessageEvent> {
    return new Observable(subscriber => {
      const child = spawn(
        'node',
        ['dist/apps/crawler/main.js', `id=${id}`],
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
