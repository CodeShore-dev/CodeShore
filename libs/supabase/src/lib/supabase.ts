import { workspaceRoot } from '@nx/devkit';
import {
  SupabaseClient,
  createClient,
} from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

let envPath = path.resolve(workspaceRoot, '.env');

if (!fs.existsSync(envPath)) {
  envPath = path.resolve(
    process.cwd(),
    'libs/supabase/.env',
  );
}

dotenv.config({
  path: envPath,
});

export let supabase: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabase) {
    const SUPABASE_URL = process.env['SUPABASE_URL'];
    const SERVICE_KEY =
      process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error('Missing Supabase credentials');
    }

    supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  }
  return supabase;
}
