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

// Namespaced sessionStorage key for the admin "view as regular user" toggle
// (task 5.3), so the toggle survives a reload within the same tab but never
// leaks across a different key namespace (see returnUrl.ts for the sibling
// `auth.returnUrl` key).
const VIEW_AS_REGULAR_USER_KEY = 'auth.viewAsRegularUser';

function readViewAsRegularUser(): boolean {
  return sessionStorage.getItem(VIEW_AS_REGULAR_USER_KEY) === 'true';
}

function writeViewAsRegularUser(value: boolean): void {
  if (value) {
    sessionStorage.setItem(VIEW_AS_REGULAR_USER_KEY, 'true');
  } else {
    sessionStorage.removeItem(VIEW_AS_REGULAR_USER_KEY);
  }
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  // Admin-only debug toggle (Req 5.1-5.4): while true, `useCanEdit()`
  // reports false even for an admin, so the UI renders as a regular user
  // would see it. `useIsAdmin()` is never affected by this toggle.
  viewAsRegularUser: boolean;
  setSession: (user: User | null) => void;
  initAuth: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setViewAsRegularUser: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isLoading: true,
  viewAsRegularUser: readViewAsRegularUser(),
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
    writeViewAsRegularUser(false);
    set({ user: null, viewAsRegularUser: false });
  },
  setViewAsRegularUser: value => {
    writeViewAsRegularUser(value);
    set({ viewAsRegularUser: value });
  },
}));

// Derived selector hooks.
export const useIsAuthenticated = (): boolean =>
  useAuthStore(state => !!state.user);

// Raw admin allowlist check (Req 5.5): unaffected by the viewAsRegularUser
// toggle, so route guards keep enforcing real access regardless of the
// admin's current preview mode.
export const useIsAdmin = (): boolean =>
  useAuthStore(state => computeCanEdit(state.user, env.adminEmails));

// Edit permission as seen by the currently rendered UI (Req 5.1, 5.2, 5.4):
// the raw admin check, suppressed while the admin is previewing as a
// regular user.
export const useCanEdit = (): boolean =>
  useAuthStore(
    state => computeCanEdit(state.user, env.adminEmails) && !state.viewAsRegularUser,
  );
