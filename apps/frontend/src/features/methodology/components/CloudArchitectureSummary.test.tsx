import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { cloudArchitecture } from '../content/cloudArchitecture';
import { CloudArchitectureSummary } from './CloudArchitectureSummary';

const labelOf = (id: string): string =>
  cloudArchitecture.nodes.find((node) => node.id === id)?.label ?? id;

describe('CloudArchitectureSummary', () => {
  it('renders both view titles as text equivalents', () => {
    render(<CloudArchitectureSummary architecture={cloudArchitecture} />);

    expect(
      screen.getByText(cloudArchitecture.views.traffic.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(cloudArchitecture.views.cicd.title),
    ).toBeInTheDocument();
  });

  it('lists a known node label drawn from the architecture data', () => {
    render(<CloudArchitectureSummary architecture={cloudArchitecture} />);

    const hasLabel = (label: string): boolean =>
      screen.getAllByText((content) =>
        content.replace(/\s+/g, '').includes(label.replace(/\s+/g, '')),
      ).length > 0;

    expect(hasLabel(labelOf('cf-worker'))).toBe(true);
    expect(hasLabel(labelOf('aws-cloudfront'))).toBe(true);
  });

  it('renders a relationship line for an edge using node labels (not raw ids)', () => {
    render(<CloudArchitectureSummary architecture={cloudArchitecture} />);

    const edge = cloudArchitecture.views.traffic.edges.find(
      (candidate) =>
        candidate.from === 'cf-worker' && candidate.to === 'aws-cloudfront',
    );
    expect(edge).toBeDefined();

    const fromLabel = labelOf(edge!.from);
    const toLabel = labelOf(edge!.to);

    const matches = screen.getAllByText((content) => {
      const normalized = content.replace(/\s+/g, '');
      return (
        normalized.includes(fromLabel.replace(/\s+/g, '')) &&
        normalized.includes(toLabel.replace(/\s+/g, '')) &&
        !normalized.includes('cf-worker') &&
        !normalized.includes('aws-cloudfront')
      );
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('keeps the summary present in the DOM as a stable region', () => {
    render(<CloudArchitectureSummary architecture={cloudArchitecture} />);

    const region = screen.getByRole('region', { name: '架構文字摘要' });
    expect(region).toBeInTheDocument();
    expect(within(region).getAllByText(/流量視角/).length).toBeGreaterThan(0);
  });
});
