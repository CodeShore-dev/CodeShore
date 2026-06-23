// Design-sync bundle stub for @supabase/supabase-js.
//
// The real client (apps/frontend/src/lib/supabase.ts) calls
// `createClient(env.supabaseUrl, env.supabaseAnonKey)` at module top-level.
// In the design-sync IIFE bundle there is no Vite env, so supabaseUrl is
// undefined and the real createClient throws "supabaseUrl is required" — which
// would crash the whole bundle at init (AppNavBar -> authStore -> lib/supabase).
// Preview cards never make auth calls, so a harmless no-op client is correct.
export function createClient() {
  const noopSubscription = { unsubscribe() {} };
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: noopSubscription } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signInWithOAuth: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: async () => ({ data: [], error: null }),
    }),
  };
}
