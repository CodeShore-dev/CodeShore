import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { env } from '../../config/env';
import { supabase } from '../../lib/supabase';
import { signInWithEmail, signInWithProvider, signOut } from './service';

// Pure derivation of edit permission (task 2.1, requirement 2.4):
// no user -> false; no admin allowlist configured -> any user can edit;
// otherwise the user's email must be on the allowlist.
export const computeCanEdit = (
  user: Pick<User, 'email'> | null,
  adminEmails: readonly string[],
): boolean => {
  if (!user) return false;
  if (!adminEmails.length) return true;
  return adminEmails.includes(user.email ?? '');
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setSession: (user: User | null) => void;
  initAuth: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isLoading: true,
  setSession: user => set({ user, isLoading: false }),
  initAuth: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.access_token) {
      localStorage.setItem('token', session.access_token);
    }
    set({ user: session?.user ?? null, isLoading: false });
  },
  loginWithGoogle: async () => {
    await signInWithProvider('google');
  },
  loginWithGithub: async () => {
    await signInWithProvider('github');
  },
  loginWithEmail: async (email, password) => {
    await signInWithEmail(email, password);
  },
  logout: async () => {
    await signOut();
    localStorage.removeItem('token');
    set({ user: null });
  },
}));

// Derived selector hooks.
export const useIsAuthenticated = (): boolean =>
  useAuthStore(state => !!state.user);

export const useCanEdit = (): boolean =>
  useAuthStore(state => computeCanEdit(state.user, env.adminEmails));
