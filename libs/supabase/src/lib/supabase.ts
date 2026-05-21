import { workspaceRoot } from '@nx/devkit';
import { createClient } from '@supabase/supabase-js';
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

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SERVICE_KEY =
  process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(
  SUPABASE_URL,
  SERVICE_KEY,
);

export function getSupabaseClient() {
  return supabase;
}

export function createSessionClient(userToken: string) {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
    auth: { persistSession: false },
  });
}
