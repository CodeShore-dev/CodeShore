import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { cloudArchitecture } from '../content/cloudArchitecture';
import { CloudArchitectureDiagram } from './CloudArchitectureDiagram';

// TechIcon fetches brand icons over the network; stub it out in tests.
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: () => null,
}));

const traffic = cloudArchitecture.views.traffic;
const cicd = cloudArchitecture.views.cicd;

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Accessible name of an interactive node button is exactly its label.
const nodeButtonName = (label: string): RegExp => new RegExp(`^${escapeRe(label)}$`);

const labelOf = (id: string): string => cloudArchitecture.nodes.find(node => node.id === id)?.label ?? id;

describe('CloudArchitectureDiagram', () => {
  it('renders every node of the given view tiers', () => {
    render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
      />,
    );
    for (const id of traffic.tiers.flat()) {
      expect(screen.getByRole('button', { name: nodeButtonName(labelOf(id)) })).toBeInTheDocument();
    }
  });

  it('calls onSelectNode with the node id when an interactive node is clicked', async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={onSelectNode}
      />,
    );
    await user.click(screen.getByRole('button', { name: nodeButtonName('Cloudflare Worker') }));
    expect(onSelectNode).toHaveBeenCalledWith('cf-worker');
  });

  it('marks the selected node with aria-pressed=true and others false', () => {
    render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId="cf-worker"
        onSelectNode={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: nodeButtonName('Cloudflare Worker') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: nodeButtonName('AWS CloudFront') })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('draws one arrow connector per edge and never leaks raw ids as text', () => {
    const { container } = render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
      />,
    );
    // One SVG <path data-edge> per relationship, each with an arrowhead marker.
    const edges = container.querySelectorAll('[data-edge]');
    expect(edges).toHaveLength(traffic.edges.length);
    edges.forEach(edge => expect(edge.getAttribute('marker-end')).toContain('arch-arrow'));
    // Node labels are shown, raw ids are not.
    expect(container).toHaveTextContent('Cloudflare Worker');
    expect(container).not.toHaveTextContent('cf-worker');
  });

  it('exposes a labelled diagram group inside a responsive scroll container', () => {
    render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: /雲端與 CI\/CD 架構/ })).toBeInTheDocument();
    // Narrow viewports scroll the bounded box horizontally (no page overflow).
    const scroll = screen.getByTestId('arch-scroll');
    expect(scroll.className).toMatch(/overflow-x-auto/);
    expect(scroll.querySelector('svg')).not.toBeNull();
  });

  it('groups nodes into labelled provider boxes', () => {
    render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
      />,
    );
    // Each cloud provider present in the view is framed and labelled.
    for (const name of ['Cloudflare', 'AWS', 'Google Cloud', 'Azure']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('switches rendered content when a different view is passed', () => {
    render(
      <CloudArchitectureDiagram
        view={cicd}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: nodeButtonName('GitHub Repo') })).toBeInTheDocument();
  });
});
