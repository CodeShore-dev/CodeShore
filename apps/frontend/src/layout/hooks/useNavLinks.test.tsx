import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@supabase/supabase-js';

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

import { useAuthStore } from '../../features/auth/authStore';
import { useNavLinks } from './useNavLinks';

function Harness() {
  const { navLinks, isActive } = useNavLinks();
  return (
    <ul>
      {navLinks.map(link => (
        <li key={link.label} data-active={isActive(link)}>
          {link.label}
        </li>
      ))}
    </ul>
  );
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Harness />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false });
});

describe('useNavLinks', () => {
  it('hides edit-only links for non-admins (req 9.5)', () => {
    renderAt('/');
    expect(screen.getByText('首頁')).toBeInTheDocument();
    expect(screen.queryByText('關鍵字')).not.toBeInTheDocument();
    expect(screen.queryByText('監控')).not.toBeInTheDocument();
  });

  it('shows edit-only links for admins (req 9.5)', () => {
    useAuthStore.setState({
      user: { email: 'admin@codeshore.dev' } as User,
      isLoading: false,
    });
    renderAt('/');
    expect(screen.getByText('關鍵字')).toBeInTheDocument();
    expect(screen.getByText('監控')).toBeInTheDocument();
  });

  it('marks the home link active only on exact path', () => {
    renderAt('/');
    expect(screen.getByText('首頁')).toHaveAttribute('data-active', 'true');
    expect(screen.getByText('職缺')).toHaveAttribute('data-active', 'false');
  });

  it('excludes the jobs link from active when a sub-view query is present', () => {
    renderAt('/jobs?tab=like');
    expect(screen.getByText('職缺')).toHaveAttribute('data-active', 'false');
  });

  it('marks the jobs link active on the plain listing', () => {
    renderAt('/jobs');
    expect(screen.getByText('職缺')).toHaveAttribute('data-active', 'true');
  });

  it('marks non-exact links active by path prefix', () => {
    renderAt('/companies/123');
    expect(screen.getByText('公司')).toHaveAttribute('data-active', 'true');
  });
});
