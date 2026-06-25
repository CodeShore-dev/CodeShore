import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { cloudArchitecture } from '../content/cloudArchitecture';
import { CloudArchitectureDiagram } from './CloudArchitectureDiagram';

const traffic = cloudArchitecture.views.traffic;
const cicd = cloudArchitecture.views.cicd;

const escapeRe = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Accessible name of an interactive node button is `${label} — ${statusWord}`.
const nodeButtonName = (label: string): RegExp =>
  new RegExp(`^${escapeRe(label)} —`);

const labelOf = (id: string): string =>
  cloudArchitecture.nodes.find((node) => node.id === id)?.label ?? id;

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
      expect(
        screen.getByRole('button', { name: nodeButtonName(labelOf(id)) }),
      ).toBeInTheDocument();
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
    await user.click(
      screen.getByRole('button', { name: nodeButtonName('Cloudflare Worker') }),
    );
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
    expect(
      screen.getByRole('button', { name: nodeButtonName('Cloudflare Worker') }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: nodeButtonName('AWS CloudFront') }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders one connector per edge using labels, not raw ids', () => {
    render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
      />,
    );
    const list = screen.getByRole('list', { name: '關係連線' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(
      traffic.edges.length,
    );
    expect(list).toHaveTextContent('Cloudflare Worker');
    expect(list).toHaveTextContent('AWS CloudFront');
    expect(list).not.toHaveTextContent('cf-worker');
  });

  it('exposes a labelled diagram group and a responsive tier container', () => {
    render(
      <CloudArchitectureDiagram
        view={traffic}
        nodes={cloudArchitecture.nodes}
        selectedNodeId={null}
        onSelectNode={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('group', { name: /雲端架構關係圖/ }),
    ).toBeInTheDocument();
    const tiers = screen.getByTestId('arch-tiers');
    expect(tiers.className).toMatch(/flex-col/);
    expect(tiers.className).toMatch(/md:flex-row/);
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
    expect(
      screen.getByRole('button', { name: nodeButtonName('GitHub Repo') }),
    ).toBeInTheDocument();
  });
});
