-- Creates the `ai_llm_setting` table: a simple key-value store for
-- backend-adjustable LLM settings, starting with `default_model` -- the
-- OpenRouter model id used by `apps/backend/src/features/ai-suggestion`'s
-- `Service.generate()` whenever a per-call `model` override is not given.
--
-- This is a scoped enhancement on top of the already-completed
-- `ai-database-maintenance-workflow` spec: that spec called Anthropic's API
-- directly with a fixed/env-configured model; this table lets an operator
-- change the default model without redeploying (e.g. to move between
-- different free-tier OpenRouter models), and each `generate()` call can
-- still override it for that one run.
--
-- Source of truth: the "Backend: switch to OpenRouter + configurable
-- default/per-call model" task's user requirement --
-- "後台可以調整是預設值，每次呼叫也可以指定，不指定就是用預設值，因為不同任務
-- 可能用不同模型" (there must be a system-wide default model, adjustable via
-- a backend/admin-accessible endpoint -- not just an environment variable --
-- and each generation run may optionally override it for that one call).
--
-- IMPORTANT: this is a reviewable, versioned artifact only. The sandbox this
-- migration was authored in has no live Supabase project available (no
-- Docker daemon running -- `docker info` fails with "Cannot connect to the
-- Docker daemon" -- and no `SUPABASE_URL`/remote project credentials in the
-- environment), so it has NOT been applied anywhere. A human must apply it
-- to the real Supabase project (e.g. via `supabase db push` or the SQL
-- editor) and then re-run `scripts/sync-supabase-schema.mjs` (`pnpm
-- db:sync`) so that `supabase/schema.sql` and the generated types in
-- `libs/data-types` reflect the live database (the hand-authored types added
-- alongside this migration in `libs/data-types/src/lib/supabase.schema.ts` /
-- `supabase.@types.ts` should then be reconciled against the generator's
-- actual output).

CREATE TABLE public."ai_llm_setting" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============ Constraints ============
ALTER TABLE public."ai_llm_setting" ADD CONSTRAINT "pk_ai_llm_setting" PRIMARY KEY (key);

-- ============ Seed data ============
-- `meta-llama/llama-3.3-70b-instruct:free` was picked as a starting default
-- only because, at authoring time, it is a currently-available, well-known
-- OpenRouter model that supports tool/function calling and has a free-tier
-- ("`:free`" family) variant -- exactly what
-- `OpenRouterLlmClient.completeStructured` needs (it always forces a single
-- tool call via `toolChoice`). This is trivially changed after deployment
-- via the new `PATCH ai-suggestion/llm-settings` admin endpoint (task
-- "Controller/DTO wiring") without redeploying -- it is not meant to be a
-- permanent choice, and OpenRouter's free-tier model lineup changes over
-- time (`openrouter/free` also exists as a router that auto-selects among
-- whatever free, tool-calling-capable models are currently available, and
-- is worth considering as an alternative default).
INSERT INTO public."ai_llm_setting" ("key", "value")
VALUES ('default_model', 'meta-llama/llama-3.3-70b-instruct:free')
ON CONFLICT (key) DO NOTHING;
