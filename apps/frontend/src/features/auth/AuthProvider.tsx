import { type ReactNode, useEffect } from 'react';

import { supabase } from '../../lib/supabase';
import { useAuthStore } from './authStore';

// Registers the Supabase auth listener and runs the initial session check
// (task 2.1, requirements 2.5, 2.6, 11.2). Mirrors the previous Vue store:
// session -> store, access_token -> localStorage (read by the httpClient
// Authorization interceptor).
export function AuthProvider({ children }: { children: ReactNode }) {
  const initAuth = useAuthStore(state => state.initAuth);
  const setSession = useAuthStore(state => state.setSession);

  useEffect(() => {
    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem('token', session.access_token);
      } else {
        localStorage.removeItem('token');
      }
      setSession(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [initAuth, setSession]);

  return <>{children}</>;
}
