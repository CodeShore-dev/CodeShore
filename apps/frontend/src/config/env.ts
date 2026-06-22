// Centralized, typed access to Vite environment variables (task 1.3).
// Replaces scattered `import.meta.env.*` reads across the app so that the
// env surface is defined in one place.

interface AppEnv {
  readonly isDev: boolean;
  readonly baseUrl: string;
  readonly appVersion: string;
  readonly adminEmails: readonly string[];
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

const parseAdminEmails = (raw: string): string[] =>
  raw
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);

export const env: AppEnv = {
  isDev: Boolean(import.meta.env.DEV),
  baseUrl: import.meta.env.BASE_URL ?? '/',
  appVersion: import.meta.env.VITE_APP_VER ?? '0.0.0-local',
  adminEmails: parseAdminEmails(import.meta.env.VITE_ADMIN_EMAILS ?? ''),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
