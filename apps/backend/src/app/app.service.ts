import { Injectable } from '@nestjs/common';

import type { SupabaseFunction } from '@codeshore/data-types';
import {
  getSalaryRange,
  getJobCount,
  getTechStats,
  getTechComboStats,
  getSalaryStats,
} from '@codeshore/data-utils';
import { Cacheable } from '@codeshore/service-cache';

@Injectable()
export class AppService {

  async getSalaryRange(): Promise<SupabaseFunction.SalaryRange> {
    return getSalaryRange();
  }

  @Cacheable({ key: 'job-count', ttl: 300 })
  async getJobCount(): Promise<SupabaseFunction.JobCount> {
    return getJobCount();
  }

  async getTechStats(): Promise<SupabaseFunction.TechStat[]> {
    return getTechStats();
  }

  @Cacheable({ key: 'CACHE_KEY_TECH_COMBO_STATS'})
  async getTechComboStats(): Promise<SupabaseFunction.TechComboStat[]> {
    return getTechComboStats();
  }

  async getSalaryStats(): Promise<SupabaseFunction.SalaryStat[]> {
    return getSalaryStats();
  }
}
