import { describe, it, expect } from 'vitest';
import {
  cloudArchitecture,
  type ArchView,
  type CloudProviderId,
} from './cloudArchitecture';

describe('cloudArchitecture', () => {
  const { nodes, views } = cloudArchitecture;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const viewList: readonly ArchView[] = [views.traffic, views.cicd];

  it('every edge in both views references existing node ids (edge integrity)', () => {
    for (const view of viewList) {
      for (const edge of view.edges) {
        expect(
          nodeIds.has(edge.from),
          `view "${view.id}" edge.from "${edge.from}" must be an existing node id`,
        ).toBe(true);
        expect(
          nodeIds.has(edge.to),
          `view "${view.id}" edge.to "${edge.to}" must be an existing node id`,
        ).toBe(true);
      }
    }
  });

  it('every interactive node has a non-empty detail.role and detail.usage', () => {
    for (const node of nodes) {
      if (node.interactive === true) {
        expect(node.detail, `node "${node.id}" is interactive and must have detail`).toBeDefined();
        expect(typeof node.detail?.role).toBe('string');
        expect((node.detail?.role ?? '').trim().length).toBeGreaterThan(0);
        expect(typeof node.detail?.usage).toBe('string');
        expect((node.detail?.usage ?? '').trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('both traffic and cicd views exist and are non-empty', () => {
    for (const view of viewList) {
      expect(view).toBeDefined();
      expect(view.tiers.length).toBeGreaterThan(0);
      expect(view.edges.length).toBeGreaterThan(0);
    }
  });

  it('every node id referenced in any view tier is an existing node id', () => {
    for (const view of viewList) {
      for (const tier of view.tiers) {
        for (const id of tier) {
          expect(
            nodeIds.has(id),
            `view "${view.id}" tier id "${id}" must be an existing node id`,
          ).toBe(true);
        }
      }
    }
  });

  it('defaultView is a valid key of views', () => {
    expect(Object.keys(views)).toContain(cloudArchitecture.defaultView);
  });

  it('nodes cover all required cloud providers', () => {
    const providers = new Set<CloudProviderId>(nodes.map((node) => node.provider));
    for (const required of ['cloudflare', 'aws', 'gcp', 'azure', 'shared'] as const) {
      expect(providers.has(required), `nodes must include a "${required}" provider`).toBe(true);
    }
  });

  it('node ids are unique (single source of truth, no duplicates)', () => {
    const ids = nodes.map((node) => node.id);
    expect(ids.length).toBe(nodeIds.size);
  });
});
