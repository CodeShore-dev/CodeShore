import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { HumanDecision } from '../service';
import { CommitPreviewPanel } from './CommitPreviewPanel';

// CommitPreviewPanel (task 6.6, requirements 5.1, 6.6, 7.1): a read-only
// preview of what will be written to the database for whichever path
// (A/B/C) the admin's currently-pending HumanDecision targets. These tests
// cover the task's literal completion criteria -- each of the three paths
// must render the correct item COUNT and CONTENT, not just "something".
describe('CommitPreviewPanel', () => {
  it('path A: renders exactly one preview row showing "<keyword> -> <confirmedTechId> 映射" (requirement 5.1)', () => {
    const decision: HumanDecision = { path: 'A', confirmedTechId: 'react' };

    render(<CommitPreviewPanel keyword="reactjs" decision={decision} />);

    const rows = screen.getAllByTestId('preview-mapping-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('reactjs');
    expect(rows[0]).toHaveTextContent('react');
    expect(rows[0]).toHaveTextContent('映射');
  });

  it('path B: renders the new tech record fields, the keyword->tech mapping row, and exactly N confirmed edge items (requirement 6.6)', () => {
    const decision: HumanDecision = {
      path: 'B',
      newTech: {
        id: 'nextjs',
        label: 'Next.js',
        category: 'frontend',
        iconSlugs: ['nextjs', 'react'],
        tags: ['ssr', 'framework'],
      },
      confirmedEdges: [
        { parentId: 'react', childId: 'nextjs' },
        { parentId: 'nextjs', childId: 'app-router' },
      ],
    };

    render(<CommitPreviewPanel keyword="next" decision={decision} />);

    // new tech record fields
    const techRecord = screen.getByTestId('preview-new-tech');
    expect(techRecord).toHaveTextContent('nextjs');
    expect(techRecord).toHaveTextContent('Next.js');
    expect(techRecord).toHaveTextContent('frontend');
    expect(techRecord).toHaveTextContent('nextjs, react');
    expect(techRecord).toHaveTextContent('ssr, framework');

    // keyword -> tech mapping row
    const mappingRows = screen.getAllByTestId('preview-mapping-row');
    expect(mappingRows).toHaveLength(1);
    expect(mappingRows[0]).toHaveTextContent('next');
    expect(mappingRows[0]).toHaveTextContent('nextjs');

    // all confirmed edges (count scales, not hardcoded to 1)
    const edgeItems = screen.getAllByTestId('preview-edge-item');
    expect(edgeItems).toHaveLength(2);
    expect(edgeItems[0]).toHaveTextContent('react → nextjs');
    expect(edgeItems[1]).toHaveTextContent('nextjs → app-router');
  });

  it('path B: scales edge count correctly with a different number of confirmed edges (not hardcoded to 1)', () => {
    const decision: HumanDecision = {
      path: 'B',
      newTech: {
        id: 'solidjs',
        label: 'SolidJS',
        category: 'frontend',
        iconSlugs: [],
        tags: [],
      },
      confirmedEdges: [{ parentId: 'javascript', childId: 'solidjs' }],
    };

    render(<CommitPreviewPanel keyword="solid" decision={decision} />);

    expect(screen.getAllByTestId('preview-edge-item')).toHaveLength(1);
  });

  it('path C: renders the keyword-bin explanation text (requirement 7.1)', () => {
    const decision: HumanDecision = { path: 'C' };

    render(<CommitPreviewPanel keyword="jquery" decision={decision} />);

    const row = screen.getByTestId('preview-bin-row');
    expect(row).toHaveTextContent('jquery');
    expect(row).toHaveTextContent('將加入 keyword bin');
    expect(screen.queryByTestId('preview-mapping-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-edge-item')).not.toBeInTheDocument();
  });
});
