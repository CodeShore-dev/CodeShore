import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createTech } = vi.hoisted(() => ({ createTech: vi.fn() }));

vi.mock('../service', () => ({
  createTech,
  updateTech: vi.fn(),
  deleteTech: vi.fn(),
  deleteKeyword: vi.fn(),
  updateTechIconSlugs: vi.fn(),
  resetMvTech: vi.fn(),
}));

import { CreateTechModal } from './CreateTechModal';

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <CreateTechModal open onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose, ...utils };
}

// Create-tech form (task 5.2, requirement 7.5): proves the previously-dead
// showCreateModal state now has a real, working form that calls
// useCreateTechMutation (via its service.createTech call) with the entered
// values, and closes on success.
describe('CreateTechModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTech.mockResolvedValue(undefined);
  });

  it('renders nothing when closed', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTechModal open={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole('heading', { name: '建立技術' }),
    ).not.toBeInTheDocument();
  });

  it('submitting the filled form calls createTech with id/keywords/category/parent, then closes', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByLabelText('技術 ID'), 'svelte');
    await user.selectOptions(screen.getByLabelText('分類'), 'framework');
    await user.type(
      screen.getByLabelText('關鍵字（以逗號分隔，可留空）'),
      'svelte, sveltekit',
    );
    await user.type(screen.getByLabelText('父技術 ID（可留空）'), 'javascript');
    await user.click(screen.getByRole('button', { name: '建立' }));

    await waitFor(() => {
      expect(createTech).toHaveBeenCalledWith(
        'svelte',
        ['svelte', 'sveltekit'],
        'framework',
        'javascript',
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a validation error and does not submit when id is empty', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: '建立' }));

    expect(screen.getByText('請輸入技術 ID')).toBeInTheDocument();
    expect(createTech).not.toHaveBeenCalled();
  });

  it('sends null parent when the parent field is left empty', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('技術 ID'), 'astro');
    await user.click(screen.getByRole('button', { name: '建立' }));

    await waitFor(() => {
      expect(createTech).toHaveBeenCalledWith(
        'astro',
        [],
        'language',
        null,
      );
    });
  });
});
