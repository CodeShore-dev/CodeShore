import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AiRecommendation } from '../service';
import { AiRecommendationCard } from './AiRecommendationCard';

// AiRecommendationCard (task 6.2, requirements 3.1-3.5, 9.2): displays the AI's
// path recommendation (A/B/C) or the ai_failed degradation variant, letting the
// admin bypass the AI entirely via onManualPathSelect when analysis fails.
describe('AiRecommendationCard', () => {
  it('renders path A: badge, matched tech id/label, confidence, reasoning, affectedJobCount (requirement 3.1, 3.2)', () => {
    const recommendation: AiRecommendation = {
      path: 'A',
      matchedTech: { id: 'react', label: 'React', category: 'frontend' },
      confidence: 0.92,
      reasoning: '此 keyword 明確對應既有的 React 技術條目。',
      affectedJobCount: 18,
    };

    render(<AiRecommendationCard recommendation={recommendation} />);

    expect(screen.getByText(/路徑 A/)).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(
      screen.getByText('此 keyword 明確對應既有的 React 技術條目。'),
    ).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('renders path B: badge, suggested tech fields, reasoning, affectedJobCount (requirement 3.1, 3.3)', () => {
    const recommendation: AiRecommendation = {
      path: 'B',
      suggestedTech: {
        id: 'bun',
        label: 'Bun',
        category: 'runtime',
        tags: [],
        iconSlugs: [],
      },
      suggestedEdges: [
        {
          type: 'parent',
          techId: 'javascript',
          techLabel: 'JavaScript',
          reasoning: 'Bun 是 JavaScript runtime。',
        },
      ],
      reasoning: '此 keyword 應建立為新的技術條目。',
      affectedJobCount: 5,
    };

    render(<AiRecommendationCard recommendation={recommendation} />);

    expect(screen.getByText(/路徑 B/)).toBeInTheDocument();
    expect(screen.getByText('bun')).toBeInTheDocument();
    expect(screen.getByText('Bun')).toBeInTheDocument();
    expect(screen.getByText(/runtime/)).toBeInTheDocument();
    expect(
      screen.getByText('此 keyword 應建立為新的技術條目。'),
    ).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders path C: badge, reasoning, affectedJobCount (requirement 3.1, 3.4)', () => {
    const recommendation: AiRecommendation = {
      path: 'C',
      reasoning: '此 keyword 為雜訊，應放入 keyword bin。',
      affectedJobCount: 2,
    };

    render(<AiRecommendationCard recommendation={recommendation} />);

    expect(screen.getByText(/路徑 C/)).toBeInTheDocument();
    expect(
      screen.getByText('此 keyword 為雜訊，應放入 keyword bin。'),
    ).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders ai_failed: error message, manual-selection prompt, three path buttons that call onManualPathSelect (requirement 3.5, 9.2)', async () => {
    const recommendation: AiRecommendation = {
      path: 'ai_failed',
      error: 'LLM 服務逾時。',
    };
    const onManualPathSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <AiRecommendationCard
        recommendation={recommendation}
        onManualPathSelect={onManualPathSelect}
      />,
    );

    expect(screen.getByText('LLM 服務逾時。')).toBeInTheDocument();
    expect(screen.getByText(/請手動選擇路徑/)).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /^A/ }));
    expect(onManualPathSelect).toHaveBeenCalledWith('A');

    await user.click(screen.getByRole('button', { name: /^B/ }));
    expect(onManualPathSelect).toHaveBeenCalledWith('B');

    await user.click(screen.getByRole('button', { name: /^C/ }));
    expect(onManualPathSelect).toHaveBeenCalledWith('C');
  });
});
