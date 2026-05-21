import { User } from '@supabase/supabase-js';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { supabase } from '../../lib/supabase';
import { signInWithEmail, signInWithProvider, signOut } from './service';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);

  const isAuthenticated = computed(() => !!user.value);

  const canEdit = computed(() => {
    if (!user.value) return false;
    const adminEmails = (
      import.meta.env.VITE_ADMIN_EMAILS ?? ''
    )
      .split(',')
      .map((e: string) => e.trim())
      .filter(Boolean);
    if (!adminEmails.length) return true;
    return adminEmails.includes(user.value.email ?? '');
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null;
    isLoading.value = false;
    if (session?.access_token) {
      localStorage.setItem('token', session.access_token);
    } else {
      localStorage.removeItem('token');
    }
  });

  const initAuth = async () => {
    const { data } = await supabase.auth.getSession();
    user.value = data.session?.user ?? null;
    if (data.session?.access_token) {
      localStorage.setItem('token', data.session.access_token);
    }
    isLoading.value = false;
  };

  const loginWithGoogle = () => signInWithProvider('google');
  const loginWithGithub = () => signInWithProvider('github');
  const loginWithEmail = (email: string, password: string) =>
    signInWithEmail(email, password);

  const logout = async () => {
    await signOut();
    localStorage.removeItem('token');
    user.value = null;
  };

  return {
    user,
    isAuthenticated,
    canEdit,
    isLoading,
    initAuth,
    loginWithGoogle,
    loginWithGithub,
    loginWithEmail,
    logout,
  };
});
