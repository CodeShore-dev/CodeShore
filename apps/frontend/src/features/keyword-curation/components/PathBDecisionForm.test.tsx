import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AiRecommendation } from '../service';
import { PathBDecisionForm } from './PathBDecisionForm';

function makeRecommendation(
  overrides?: Partial<Extract<AiRecommendation, { path: 'B' }>>,
): Extract<AiRecommendation, { path: 'B' }> {
  return {
    path: 'B',
    suggestedTech: {
      id: 'graphql',
      label: 'GraphQL',
      category: 'framework',
      tags: ['api'],
      iconSlugs: [],
    },
    suggestedEdges: [],
    reasoning: 'AI 建議理由',
    affectedJobCount: 3,
    ...overrides,
  };
}

// PathBDecisionForm (task 6.4, requirements 4.1, 4.3, 6.1-6.5, 6.8): human
// decision gate for path B (create a new tech entry). Covers exactly the
// task's completion criteria: (1) front-end cycle-warning trigger condition,
// (2) duplicateIdError display + edit-and-resubmit, (3) correct HumanDecision
// on submit with edited fields + accepted-subset edges.
describe('PathBDecisionForm', () => {
  it('pre-fills fields from the AI suggestion (requirement 6.1)', () => {
    render(
      <PathBDecisionForm
        recommendation={makeRecommendation()}
        newTechId="graphql"
        onSubmit={vi.fn()}
      />,
    );

    expect((screen.getByLabelText('技術 ID') as HTMLInputElement).value).toBe('graphql');
    expect((screen.getByLabelText('名稱') as HTMLInputElement).value).toBe('GraphQL');
    expect((screen.getByLabelText('分類') as HTMLSelectElement).value).toBe('framework');
  });

  describe('cycle warning (requirement 6.5, UI feedback layer only)', () => {
    function makeCyclicRecommendation() {
      return makeRecommendation({
        suggestedEdges: [
          { type: 'parent', techId: 'a', techLabel: 'A', reasoning: 'a is parent' },
          { type: 'child', techId: 'a', techLabel: 'A', reasoning: 'a is also child' },
        ],
      });
    }

    it('does NOT warn and keeps submit enabled when only one of a direct-loop pair is accepted', async () => {
      const user = userEvent.setup();
      render(
        <PathBDecisionForm
          recommendation={makeCyclicRecommendation()}
          newTechId="graphql"
          onSubmit={vi.fn()}
        />,
      );

      // Reject the second (child) edge, leaving only the parent edge accepted.
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      expect(
        screen.queryByText('偵測到直接循環關聯（A→B 且 B→A），請取消其中一條後再提交。'),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '確認建立新技術' })).not.toBeDisabled();
    });

    it('warns and disables submit when both edges of a direct A->B + B->A loop are accepted', () => {
      render(
        <PathBDecisionForm
          recommendation={makeCyclicRecommendation()}
          newTechId="graphql"
          onSubmit={vi.fn()}
        />,
      );

      // Both suggested edges default to accepted -- 'a' as parent of the new
      // tech AND 'a' as child of the new tech is a direct A<->B loop.
      expect(
        screen.getByText('偵測到直接循環關聯（A→B 且 B→A），請取消其中一條後再提交。'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '確認建立新技術' })).toBeDisabled();
    });
  });

  describe('duplicateIdError (requirement 6.8)', () => {
    it('shows the duplicate id error message', () => {
      render(
        <PathBDecisionForm
          recommendation={makeRecommendation()}
          newTechId="graphql"
          duplicateIdError="duplicate_id"
          onSubmit={vi.fn()}
        />,
      );

      expect(screen.getByText(/ID 重複，請修改後重新提交/)).toBeInTheDocument();
    });

    it('submits with the NEW id after the admin edits the duplicated id', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <PathBDecisionForm
          recommendation={makeRecommendation()}
          newTechId="graphql"
          duplicateIdError="duplicate_id"
          onSubmit={onSubmit}
        />,
      );

      const idInput = screen.getByLabelText('技術 ID');
      await user.clear(idInput);
      await user.type(idInput, 'graphql-v2');
      await user.click(screen.getByRole('button', { name: '確認建立新技術' }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'B',
          newTech: expect.objectContaining({ id: 'graphql-v2' }),
        }),
      );
    });
  });

  describe('submit produces the correct HumanDecision (requirement 6.2, 6.4, 6.6, 6.7)', () => {
    it('reflects edited fields and only the accepted subset of edges, correctly mapped to parentId/childId', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      const recommendation = makeRecommendation({
        suggestedEdges: [
          { type: 'parent', techId: 'javascript', techLabel: 'JavaScript', reasoning: 'r1' },
          { type: 'child', techId: 'apollo-client', techLabel: 'Apollo Client', reasoning: 'r2' },
        ],
      });

      render(
        <PathBDecisionForm
          recommendation={recommendation}
          newTechId="graphql"
          onSubmit={onSubmit}
        />,
      );

      await user.clear(screen.getByLabelText('名稱'));
      await user.type(screen.getByLabelText('名稱'), 'GraphQL Edited');
      await user.selectOptions(screen.getByLabelText('分類'), 'tool');
      await user.clear(screen.getByLabelText('Icon Slugs（以逗號分隔，可留空）'));
      await user.type(screen.getByLabelText('Icon Slugs（以逗號分隔，可留空）'), 'graphql, gql');
      await user.clear(screen.getByLabelText('Tags（以逗號分隔，可留空）'));
      await user.type(screen.getByLabelText('Tags（以逗號分隔，可留空）'), 'api, query');

      // Reject the second (child) edge; only the parent edge should end up
      // in confirmedEdges.
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await user.click(screen.getByRole('button', { name: '確認建立新技術' }));

      expect(onSubmit).toHaveBeenCalledWith({
        path: 'B',
        newTech: {
          id: 'graphql',
          label: 'GraphQL Edited',
          category: 'tool',
          iconSlugs: ['graphql', 'gql'],
          tags: ['api', 'query'],
        },
        confirmedEdges: [{ parentId: 'javascript', childId: 'graphql' }],
      });
    });

    it('maps a "child"-type accepted edge to { parentId: newTechId, childId: techId }', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      const recommendation = makeRecommendation({
        suggestedEdges: [
          { type: 'child', techId: 'apollo-client', techLabel: 'Apollo Client', reasoning: 'r' },
        ],
      });

      render(
        <PathBDecisionForm
          recommendation={recommendation}
          newTechId="graphql"
          onSubmit={onSubmit}
        />,
      );

      await user.click(screen.getByRole('button', { name: '確認建立新技術' }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmedEdges: [{ parentId: 'graphql', childId: 'apollo-client' }],
        }),
      );
    });

    it('submits with the ADMIN-EDITED target tech id, not the AI suggestion (requirement 6.4)', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      const recommendation = makeRecommendation({
        suggestedEdges: [
          { type: 'parent', techId: 'javascript', techLabel: 'JavaScript', reasoning: 'r1' },
        ],
      });

      render(
        <PathBDecisionForm
          recommendation={recommendation}
          newTechId="graphql"
          onSubmit={onSubmit}
        />,
      );

      // Modify the suggested edge's target tech id from the AI's suggestion
      // ('javascript') to a different one ('typescript') before submitting.
      const techIdInput = screen.getByLabelText('父項 關聯目標技術 ID：JavaScript');
      await user.clear(techIdInput);
      await user.type(techIdInput, 'typescript');

      await user.click(screen.getByRole('button', { name: '確認建立新技術' }));

      // The edited id ('typescript') must be used, not the AI's original
      // suggestion ('javascript'), and the parent-type mapping direction
      // (parentId = edited techId, childId = newTechId) must still hold.
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmedEdges: [{ parentId: 'typescript', childId: 'graphql' }],
        }),
      );
    });
  });
});
