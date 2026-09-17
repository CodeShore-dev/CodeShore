import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../auth/auth.guard';
import { Controller } from './controller';
import { Service } from './service';

/**
 * Task 2.2 (design.md "API 端點（GET /api/job/location-tech）"): a public,
 * QueryDto-passthrough endpoint mirroring the existing `@Get('location')`
 * (`getLocationGroups`) endpoint's shape, but calling
 * `Service.getLocationTechStats` instead.
 */
describe('Controller.getLocationTechStats (task 2.2, GET /api/job/location-tech)', () => {
  it('calls Service.getLocationTechStats with the given query and returns its result exactly', async () => {
    const rows = [
      { location: '台北市中正區', tech: 'react', job_count: 12 },
      { location: '台北市中正區', tech: 'typescript', job_count: 8 },
    ];
    const service = {
      getLocationTechStats: vi.fn().mockResolvedValue(rows),
    };
    const controller = new Controller(service as unknown as Service);
    const query = { where: { tech: { eq: 'react' } } } as any;

    const result = await controller.getLocationTechStats(query);

    expect(service.getLocationTechStats).toHaveBeenCalledWith(query);
    expect(result).toBe(rows);
  });

  /**
   * Same repo convention as `job-filter-watchlist/controller.spec.ts` and
   * `keyword-curation/controller.spec.ts`: `@Public()` is applied via
   * `SetMetadata`, written directly onto the method at decoration time
   * independent of DI/param-type reflection, so `AuthGuard` can be exercised
   * directly against the real, already-decorated `Controller.prototype`
   * method without booting a full HTTP server (this repo's Vitest/esbuild
   * pipeline does not emit `design:paramtypes`, which breaks a real
   * `Test.createTestingModule` + `app.listen()` HTTP-level test for guards --
   * see those files' doc comments for the full investigation).
   */
  it('is decorated @Public() so an unauthenticated request is let through by AuthGuard, like the sibling GET /job/location endpoint', async () => {
    const guard = new AuthGuard(new Reflector());
    const request = { headers: {}, query: {} };
    const context = {
      getHandler: () => Controller.prototype.getLocationTechStats,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

/**
 * Task 13.2 (design.md "API 端點（GET /api/job/location-salary）"): a public,
 * QueryDto-passthrough endpoint mirroring the existing
 * `@Get('location-tech')` (`getLocationTechStats`) endpoint's shape, but
 * calling `Service.getLocationSalaryStats` instead.
 */
describe('Controller.getLocationSalaryStats (task 13.2, GET /api/job/location-salary)', () => {
  it('calls Service.getLocationSalaryStats with the given query and returns its result exactly', async () => {
    const rows = [
      {
        location: '台北市信義區',
        salary_type: 'monthly',
        job_count: 12,
        avg_salary: 55000,
      },
      {
        location: '台北市信義區',
        salary_type: 'yearly',
        job_count: 3,
        avg_salary: 800000,
      },
    ];
    const service = {
      getLocationSalaryStats: vi.fn().mockResolvedValue(rows),
    };
    const controller = new Controller(service as unknown as Service);
    const query = {
      where: { location: { eq: '台北市信義區' } },
    } as any;

    const result = await controller.getLocationSalaryStats(query);

    expect(service.getLocationSalaryStats).toHaveBeenCalledWith(query);
    expect(result).toBe(rows);
  });

  /**
   * Same repo convention as the sibling `location-tech` test above: `@Public()`
   * is applied via `SetMetadata`, written directly onto the method at
   * decoration time independent of DI/param-type reflection, so `AuthGuard`
   * can be exercised directly against the real, already-decorated
   * `Controller.prototype` method without booting a full HTTP server.
   */
  it('is decorated @Public() so an unauthenticated request is let through by AuthGuard, like the sibling GET /job/location-tech endpoint', async () => {
    const guard = new AuthGuard(new Reflector());
    const request = { headers: {}, query: {} };
    const context = {
      getHandler: () => Controller.prototype.getLocationSalaryStats,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
