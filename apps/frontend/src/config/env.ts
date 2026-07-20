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
  /**
   * 生產環境網站根 URL，不含結尾斜線。
   * 用於 PageSeo canonical、og:image、hreflang 等絕對 URL 建構。
   * 由 VITE_SITE_URL 環境變數注入；未設定時預設 'https://codeshore.dev'。
   */
  readonly siteUrl: string;
  /**
   * GA4 Measurement ID（格式 G-XXXXXXXXXX）。
   * 由 VITE_GA_MEASUREMENT_ID 環境變數注入；未設定時為空字串，Analytics 元件會停用追蹤。
   */
  readonly gaMeasurementId: string;
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
  siteUrl: import.meta.env.VITE_SITE_URL ?? 'https://codeshore.dev',
  gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID ?? '',
};
