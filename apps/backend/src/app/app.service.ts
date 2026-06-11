import { Injectable } from '@nestjs/common';

import type { SupabaseFunction } from '@codeshore/data-types';
import {
  MvSalaryTypeMedianRatioService,
  MvSalaryWeightedRatioService,
  getJobCount,
} from '@codeshore/data-utils';
import { Cacheable } from '@codeshore/service-cache';

@Injectable()
export class AppService {
  constructor(
    private mvSalaryTypeMedianRatioService: MvSalaryTypeMedianRatioService,
    private mvSalaryWeightedRatioService: MvSalaryWeightedRatioService,
  ) {}

  @Cacheable({ key: getJobCount.name, ttl: 300 })
  async getJobCount(): Promise<SupabaseFunction.JobCount> {
    return (await getJobCount()).data;
  }

  @Cacheable({ key: MvSalaryTypeMedianRatioService.name })
  async getMvSalaryTypeMedianRatio() {
    return this.mvSalaryTypeMedianRatioService.fetchAll();
  }

  @Cacheable({ key: MvSalaryWeightedRatioService.name })
  async getMvSalaryWeightedRatio() {
    return this.mvSalaryWeightedRatioService.fetchAll();
  }
}
