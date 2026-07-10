import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useTechsQuery } = vi.hoisted(() => ({
  useTechsQuery: vi.fn(),
}));

vi.mock('../../keyword/queries', () => ({ useTechsQuery }));

import { PathADecisionForm } from './PathADecisionForm';

function makeTechs() {
  return [
    { tech: 'react', label: 'React', category: 'frontend' },
    { tech: 'vue', label: 'Vue', category: 'frontend' },
    { tech: 'svelte', label: 'Svelte', category: 'frontend' },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  useTechsQuery.mockReturnValue({ data: makeTechs() });
});

// PathADecisionForm (task 6.3, requirements 4.1, 4.2, 5.1): the human
// decision gate for path A. Pre-selects the AI-suggested tech (editable),
// lets the admin pick a different tech from the full catalog fetched via
// useTechsQuery(), and reports { path: 'A', confirmedTechId } on submit.
describe('PathADecisionForm', () => {
  it('renders with the AI-suggested tech pre-selected (requirement 4.2)', () => {
    render(
      <PathADecisionForm aiSuggestedTechId="vue" onSubmit={vi.fn()} />,
    );

    const select = screen.getByLabelText('目標技術') as HTMLSelectElement;
    expect(select.value).toBe('vue');
  });

  it('submits { path: "A", confirmedTechId: <new selection> } after the admin picks a different tech (requirement 4.2, 5.1)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <PathADecisionForm aiSuggestedTechId="vue" onSubmit={onSubmit} />,
    );

    const select = screen.getByLabelText('目標技術') as HTMLSelectElement;
    await user.selectOptions(select, 'svelte');
    await user.click(screen.getByRole('button', { name: '確認映射' }));

    expect(onSubmit).toHaveBeenCalledWith({
      path: 'A',
      confirmedTechId: 'svelte',
    });
  });

  it('submits { path: "A", confirmedTechId: <original AI suggestion> } when the admin submits without changing the selection (requirement 4.2, 5.1)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <PathADecisionForm aiSuggestedTechId="react" onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole('button', { name: '確認映射' }));

    expect(onSubmit).toHaveBeenCalledWith({
      path: 'A',
      confirmedTechId: 'react',
    });
  });
});
