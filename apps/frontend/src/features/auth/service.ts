import { Provider } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';

const REDIRECT_URL = `${window.location.origin}/auth/callback`;

export const signInWithProvider = (provider: Provider) =>
  supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: REDIRECT_URL },
  });

export const signInWithEmail = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();
