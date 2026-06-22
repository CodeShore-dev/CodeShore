import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../features/auth/authStore';
import { RootLayout } from './RootLayout';

beforeEach(() => {
  useAuthStore.setState({ user: null, isLoading: false });
});

describe('RootLayout', () => {
  it('renders the shell (nav, footer) and routed content (req 9.5)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<div>home content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('home content')).toBeInTheDocument();
    expect(screen.getByText('碼的，上岸了')).toBeInTheDocument();
    expect(screen.getByText('資料每週自動更新')).toBeInTheDocument();
  });
});
