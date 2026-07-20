import {
  Controller as ControllerDecorator,
  Delete,
  Get,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CacheEntryInfo, CacheService } from '@codeshore/service-cache';

import { AdminOnly } from '../auth/auth.decorator';

const name = 'cache';

@ApiBearerAuth()
@ApiTags(name)
@AdminOnly()
@ControllerDecorator(name)
export class Controller {
  constructor(@Inject(CacheService) private readonly cacheService: CacheService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all current cache entries (with write time and estimated size) plus the service cloud memory usage',
  })
  list(): {
    count: number;
    totalSize: number;
    totalSizeHuman: string;
    memory: MemoryInfo;
    entries: CacheEntryInfo[];
  } {
    const entries = this.cacheService.list();
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    return {
      count: entries.length,
      totalSize,
      totalSizeHuman: humanSize(totalSize),
      memory: memoryInfo(),
      entries,
    };
  }

  @Get('memory')
  @ApiOperation({
    summary:
      'Actual memory the service holds in the cloud (rss / heap / external); gc=true triggers a GC before measuring (requires starting with --expose-gc)',
  })
  @ApiQuery({
    name: 'gc',
    required: false,
    description:
      'Whether to trigger a GC before measuring. true / 1 / empty string are treated as true; only takes effect when the process was started with --expose-gc.',
    example: 'true',
  })
  memory(@Query('gc') gc?: string): MemoryInfo & { gcRan: boolean } {
    const before = parseBool(gc) ? runGc() : false;
    return { ...memoryInfo(), gcRan: before };
  }

  @Delete()
  @ApiOperation({
    summary:
      'Invalidate cache: pass the keys query param to clear one or more specific entries, omit it to clear everything',
  })
  @ApiQuery({
    name: 'keys',
    required: false,
    description:
      'The cache keys to clear. Supports comma-separated (keys=a,b) or repeated params (keys=a&keys=b); omit to clear all.',
  })
  async invalidate(
    @Query('keys') keys?: string | string[],
  ): Promise<{ invalidated: string[] }> {
    const list = normalizeKeys(keys);
    if (list.length === 0) {
      return { invalidated: await this.cacheService.invalidateAll() };
    }
    return { invalidated: await this.cacheService.invalidate(list) };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Invalidate a single specified cache entry' })
  @ApiParam({
    name: 'key',
    description: 'The cache key to clear',
    example: 'keyword:group:view',
  })
  async invalidateOne(
    @Param('key') key: string,
  ): Promise<{ invalidated: string[] }> {
    return { invalidated: await this.cacheService.invalidate(key) };
  }
}

interface MemoryInfo {
  /** Resident Set Size — total memory the process holds in RAM. This is what cloud billing/limits track. */
  rss: number;
  rssHuman: string;
  /** V8 heap currently in use — actual memory used by JS objects (cache contents mostly live here). */
  heapUsed: number;
  heapUsedHuman: string;
  /** V8 heap reserved by the process. */
  heapTotal: number;
  heapTotalHuman: string;
  /** Off-heap memory used by C++ objects bound to JS (e.g. Buffers). */
  external: number;
  externalHuman: string;
  /** Memory allocated for ArrayBuffers / Buffers, included in external. */
  arrayBuffers: number;
  arrayBuffersHuman: string;
}

/**
 * Triggers a full GC when the process was started with `--expose-gc`.
 * Returns whether GC actually ran (false if the flag is absent).
 */
function runGc(): boolean {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc !== 'function') return false;
  gc();
  return true;
}

function parseBool(value?: string): boolean {
  return value === 'true' || value === '1' || value === '';
}

function memoryInfo(): MemoryInfo {
  const m = process.memoryUsage();
  return {
    rss: m.rss,
    rssHuman: humanSize(m.rss),
    heapUsed: m.heapUsed,
    heapUsedHuman: humanSize(m.heapUsed),
    heapTotal: m.heapTotal,
    heapTotalHuman: humanSize(m.heapTotal),
    external: m.external,
    externalHuman: humanSize(m.external),
    arrayBuffers: m.arrayBuffers,
    arrayBuffersHuman: humanSize(m.arrayBuffers),
  };
}

/** Accepts `?keys=a,b`, `?keys=a&keys=b`, or both, and flattens to a list. */
function normalizeKeys(keys?: string | string[]): string[] {
  if (!keys) return [];
  const arr = Array.isArray(keys) ? keys : [keys];
  return arr
    .flatMap(k => k.split(','))
    .map(k => k.trim())
    .filter(Boolean);
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
