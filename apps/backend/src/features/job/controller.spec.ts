import {
  BadRequestException,
  ValidationPipe,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../auth/auth.guard';
import { Controller } from './controller';
import { SetJobPreferenceDto } from './dto';
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

/**
 * Task 2.2 (design.md "Backend：Job Controller / Service", PATCH row):
 * the endpoint takes an optional `reason` in the body and forwards it; the
 * user id always comes from `@CurrentUser()` (1.5), never from the body.
 */
describe('Controller.setJobPreference (task 2.2, PATCH /api/job/preference/:jobId/:preference)', () => {
  const makeController = () => {
    const service = {
      setJobPreference: vi.fn().mockResolvedValue({ result: [], count: 1 }),
    };
    const controller = new Controller(service as unknown as Service);
    return { controller, service };
  };

  it('forwards body.reason and the current user id to the service', async () => {
    const { controller, service } = makeController();
    const body = { reason: '想投', user_id: 'someone-else' } as any;

    const result = await controller.setJobPreference(
      'job-1',
      'like',
      body,
      { id: 'user-1' } as any,
    );

    expect(service.setJobPreference).toHaveBeenCalledWith(
      'job-1',
      'like',
      'user-1',
      '想投',
    );
    expect(result).toEqual({ result: [], count: 1 });
  });

  it('still works with an empty body (old frontend sends {})', async () => {
    const { controller, service } = makeController();

    await controller.setJobPreference('job-1', 'dislike', {} as any, {
      id: 'user-1',
    } as any);

    expect(service.setJobPreference).toHaveBeenCalledWith(
      'job-1',
      'dislike',
      'user-1',
      undefined,
    );
  });

  it('still works with a missing body', async () => {
    const { controller, service } = makeController();

    await controller.setJobPreference(
      'job-1',
      'like',
      undefined as any,
      { id: 'user-1' } as any,
    );

    expect(service.setJobPreference).toHaveBeenCalledWith(
      'job-1',
      'like',
      'user-1',
      undefined,
    );
  });
});

/**
 * Task 2.2: `SetJobPreferenceDto` validated through the same global
 * ValidationPipe options the app uses (libs/service-transport:
 * transform + whitelist, forbidNonWhitelisted: false).
 */
describe('SetJobPreferenceDto (task 2.2)', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
  });
  const metadata = {
    type: 'body' as const,
    metatype: SetJobPreferenceDto,
    data: '',
  };

  it('accepts an empty body', async () => {
    await expect(pipe.transform({}, metadata)).resolves.toEqual({});
  });

  it('does not reject a missing body', async () => {
    const result = await pipe.transform(undefined, metadata);
    expect(result?.reason).toBeUndefined();
  });

  it('accepts a string reason and strips unknown fields such as user_id', async () => {
    const result = await pipe.transform(
      { reason: '想投', user_id: 'someone-else' },
      metadata,
    );
    expect(result).toBeInstanceOf(SetJobPreferenceDto);
    expect(result).toEqual({ reason: '想投' });
  });

  it('rejects a non-string reason with a 400', async () => {
    await expect(
      pipe.transform({ reason: 123 }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
