import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@supabase/supabase-js';

// Deterministic env so useIsAdmin/useCanEdit do not depend on the real
// .env allowlist.
vi.mock('../../config/env', () => ({
  env: {
    isDev: true,
    baseUrl: '/',
    appVersion: 'test',
    adminEmails: ['admin@codeshore.dev'],
    supabaseUrl: 'http://localhost',
    supabaseAnonKey: 'anon-key',
  },
}));

// Mock the Supabase client so logout() does not hit the network.
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signOut: () => Promise.resolve({ error: null }) } },
}));

import {
  computeCanEdit,
  useAuthStore,
  useCanEdit,
  useIsAdmin,
} from './authStore';

const adminUser = { email: 'admin@codeshore.dev' } as User;
const normalUser = { email: 'user@x.com' } as User;

// Requirement 2.4: admin-only edit permission derivation.
describe('computeCanEdit', () => {
  it('returns false when there is no user', () => {
    expect(computeCanEdit(null, ['admin@codeshore.dev'])).toBe(false);
  });

  it('allows any signed-in user when no admin allowlist is configured', () => {
    expect(computeCanEdit({ email: 'anyone@x.com' }, [])).toBe(true);
  });

  it('allows a user whose email is on the allowlist', () => {
    expect(
      computeCanEdit({ email: 'admin@codeshore.dev' }, [
        'admin@codeshore.dev',
        'other@codeshore.dev',
      ]),
    ).toBe(true);
  });

  it('denies a user whose email is not on the allowlist', () => {
    expect(
      computeCanEdit({ email: 'nope@x.com' }, ['admin@codeshore.dev']),
    ).toBe(false);
  });

  it('denies a user with no email against a non-empty allowlist', () => {
    expect(
      computeCanEdit({ email: undefined }, ['admin@codeshore.dev']),
    ).toBe(false);
  });
});

// Requirement 5.1, 5.2, 5.4: viewAsRegularUser toggle overlays useCanEdit()
// without affecting the raw useIsAdmin() permission check.
describe('useIsAdmin / useCanEdit with viewAsRegularUser toggle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({
      user: adminUser,
      isLoading: false,
      viewAsRegularUser: false,
    });
  });

  it('useIsAdmin stays true for an admin regardless of the toggle', () => {
    const { result: isAdmin } = renderHook(() => useIsAdmin());
    expect(isAdmin.current).toBe(true);

    act(() => {
      useAuthStore.getState().setViewAsRegularUser(true);
    });
    expect(isAdmin.current).toBe(true);
  });

  it('useCanEdit flips to false once the toggle is on, and back to true once off', () => {
    const { result: canEdit } = renderHook(() => useCanEdit());
    expect(canEdit.current).toBe(true);

    act(() => {
      useAuthStore.getState().setViewAsRegularUser(true);
    });
    expect(canEdit.current).toBe(false);

    act(() => {
      useAuthStore.getState().setViewAsRegularUser(false);
    });
    expect(canEdit.current).toBe(true);
  });

  it('logout resets viewAsRegularUser to false', async () => {
    useAuthStore.getState().setViewAsRegularUser(true);
    expect(useAuthStore.getState().viewAsRegularUser).toBe(true);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().viewAsRegularUser).toBe(false);
  });
});

// Requirement 5.1, 5.2, 5.4: non-admin half of the (admin/non-admin) x
// (viewAsRegularUser on/off) matrix -- the toggle must have no effect when
// the user was never an admin in the first place.
describe('useIsAdmin / useCanEdit for a non-admin user', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({
      user: normalUser,
      isLoading: false,
      viewAsRegularUser: false,
    });
  });

  it('useIsAdmin and useCanEdit are both false for a non-admin with the toggle off', () => {
    const { result: isAdmin } = renderHook(() => useIsAdmin());
    const { result: canEdit } = renderHook(() => useCanEdit());

    expect(isAdmin.current).toBe(false);
    expect(canEdit.current).toBe(false);
  });

  it('useIsAdmin and useCanEdit remain false for a non-admin with the toggle on', () => {
    const { result: isAdmin } = renderHook(() => useIsAdmin());
    const { result: canEdit } = renderHook(() => useCanEdit());

    act(() => {
      useAuthStore.getState().setViewAsRegularUser(true);
    });

    expect(isAdmin.current).toBe(false);
    expect(canEdit.current).toBe(false);
  });
});
