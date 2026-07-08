import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

/**
 * Simple key-value store for backend-adjustable LLM settings (see
 * `supabase/migrations/20260708000000_create_ai_llm_setting.sql`). Backs
 * `apps/backend/src/features/ai-suggestion/service.ts`'s `default_model`
 * resolution: a system-wide default that is changeable via the
 * `PATCH ai-suggestion/llm-settings` admin endpoint without redeploying,
 * per-call overridable via `POST ai-suggestion/generate`'s optional `model`.
 *
 * `key` (not `id`) is this table's primary key
 * (`supabase/migrations/20260708000000_create_ai_llm_setting.sql`'s
 * `pk_ai_llm_setting`), so the inherited `TableService.upsert` is told to
 * conflict-resolve on `key` explicitly rather than relying on the default
 * `id`-shaped assumption baked into `TableService.update`/`delete` (neither
 * of which this service uses -- `setValue` always upserts).
 */
export class AiLlmSettingService extends TableService<SupabaseTable.AiLlmSetting> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'ai_llm_setting', logger, {
      upsert: { onConflict: 'key' },
    });
  }

  /**
   * Fetches a single setting's value by `key`. Returns `null` (rather than
   * throwing or returning `undefined`) when no row matches -- e.g. before
   * the migration's `default_model` seed row exists, or for a key nobody
   * has ever written -- so callers (`Service.generate()`'s default-model
   * resolution) can cleanly fall through to a further fallback.
   */
  async getValue(key: string): Promise<string | null> {
    const { result } = await this.fetchAll({
      where: { key: { eq: key } },
    });
    return result[0]?.value ?? null;
  }

  /**
   * Upserts `key`'s value, refreshing `updated_at`. Used by
   * `Service.updateLlmSettings()` to change the stored `default_model`
   * without redeploying.
   */
  async setValue(key: string, value: string): Promise<void> {
    const { error } = await this.upsert([
      { key, value, updated_at: new Date().toISOString() },
    ]);
    if (error) {
      throw error;
    }
  }
}
