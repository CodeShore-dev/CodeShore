import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupabaseView } from '@codeshore/data-types';

vi.mock('../../../config/env', () => ({
  env: {
    isDev: true,
    baseUrl: '/',
    appVersion: 'test',
    adminEmails: ['admin@codeshore.dev'],
    supabaseUrl: 'http://localhost',
    supabaseAnonKey: 'anon-key',
  },
}));

const { updateTech, deleteTech, deleteKeyword, fetchMvTech } = vi.hoisted(
  () => ({
    updateTech: vi.fn(),
    deleteTech: vi.fn(),
    deleteKeyword: vi.fn(),
    fetchMvTech: vi.fn(),
  }),
);

vi.mock('../service', () => ({
  updateTech,
  deleteTech,
  deleteKeyword,
  fetchMvTech,
  createTech: vi.fn(),
  updateTechIconSlugs: vi.fn(),
  resetMvTech: vi.fn(),
  fetchTechCategories: vi.fn(),
}));

import { useAuthStore } from '../../auth/authStore';
import { TechCard } from './TechCard';

function makeGroup(
  overrides: Partial<SupabaseView.MvTech> = {},
): SupabaseView.MvTech {
  return {
    tech: 'react',
    label: 'React',
    category: 'framework',
    count: 5,
    keywords: ['react', 'reactjs'],
    parents: ['javascript'],
    children: null,
    icon_slugs: null,
    tags: null,
    ...overrides,
  };
}

function renderCard(group: SupabaseView.MvTech) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TechCard group={group} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// TechCard (task 5.2, requirement 7.5): proves the previously-dead
// isEditing / assigningKeyword local state now drive real forms wired to
// useUpdateTechMutation / useAssignKeywordToGroupMutation, and that the
// already-working delete flow (task 8.2) has not regressed.
describe('TechCard — edit / assign / delete wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { email: 'admin@codeshore.dev' } as never,
      isLoading: false,
    });
    updateTech.mockResolvedValue(undefined);
    deleteTech.mockResolvedValue(undefined);
    deleteKeyword.mockResolvedValue(undefined);
    fetchMvTech.mockResolvedValue({
      result: [
        makeGroup({
          tech: 'javascript',
          label: 'JavaScript',
          category: 'language',
          keywords: [],
          parents: null,
        }),
        makeGroup(),
      ],
      count: 2,
    });
  });

  it('編輯 opens a form pre-filled with the current category/keywords/parent, and 儲存 calls useUpdateTechMutation with the edited values', async () => {
    const user = userEvent.setup();
    renderCard(makeGroup());

    await user.click(screen.getByRole('button', { name: /編輯/ }));

    expect(screen.getByLabelText('分類')).toHaveValue('framework');
    expect(screen.getByLabelText('父技術 ID（可留空）')).toHaveValue(
      'javascript',
    );
    expect(screen.getByLabelText('關鍵字（以逗號分隔）')).toHaveValue(
      'react, reactjs',
    );

    await user.clear(screen.getByLabelText('父技術 ID（可留空）'));
    await user.type(
      screen.getByLabelText('父技術 ID（可留空）'),
      'typescript',
    );
    await user.click(screen.getByRole('button', { name: '儲存' }));

    await waitFor(() => {
      expect(updateTech).toHaveBeenCalledWith('react', {
        keywords: ['react', 'reactjs'],
        category: 'framework',
        parent: 'typescript',
      });
    });

    // Closes back to the read-only card on success.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /編輯/ })).toBeInTheDocument();
    });
  });

  it('編輯 表單取消後恢復唯讀，不呼叫 mutation', async () => {
    const user = userEvent.setup();
    renderCard(makeGroup());

    await user.click(screen.getByRole('button', { name: /編輯/ }));
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.getByRole('button', { name: /編輯/ })).toBeInTheDocument();
    expect(updateTech).not.toHaveBeenCalled();
  });

  it('加入技術 shows a target picker; confirming calls useAssignKeywordToGroupMutation, merging into the selected group', async () => {
    const user = userEvent.setup();
    const bareKeyword = makeGroup({
      tech: 'reactjs',
      label: 'reactjs',
      category: null,
      keywords: null,
      parents: null,
    });
    renderCard(bareKeyword);

    await user.click(screen.getByRole('button', { name: /加入技術/ }));

    const targetSelect = await screen.findByRole('combobox');
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'React' }),
      ).toBeInTheDocument(),
    );
    await user.selectOptions(targetSelect, 'react');
    await user.click(screen.getByRole('button', { name: '確認' }));

    await waitFor(() => {
      expect(updateTech).toHaveBeenCalledWith('react', {
        keywords: ['react', 'reactjs', 'reactjs'],
        category: 'framework',
        parent: 'javascript',
      });
    });
  });

  it('刪除 仍會在確認後呼叫 useDeleteKeywordItemMutation（regression check for task 8.2）', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderCard(makeGroup());

    await user.click(screen.getByRole('button', { name: /刪除/ }));

    await waitFor(() => {
      expect(deleteTech).toHaveBeenCalledWith('react');
    });
    expect(deleteKeyword).not.toHaveBeenCalled();
  });
});
