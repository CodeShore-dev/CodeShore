import { describe, expect, it } from 'vitest';

import { type DataFlowGroupId, type DataFlowView, dataNormalization } from './dataNormalization';

describe('dataNormalization', () => {
  const { nodes, views } = dataNormalization;
  const nodeIds = new Set(nodes.map(node => node.id));
  const viewList: readonly DataFlowView[] = [views.split, views.process];

  it('every edge in every view references existing node ids (edge integrity)', () => {
    for (const view of viewList) {
      for (const edge of view.edges) {
        expect(nodeIds.has(edge.from), `view "${view.id}" edge.from "${edge.from}" must be an existing node id`).toBe(
          true,
        );
        expect(nodeIds.has(edge.to), `view "${view.id}" edge.to "${edge.to}" must be an existing node id`).toBe(true);
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

  it('both split and process views exist and are non-empty', () => {
    for (const view of viewList) {
      expect(view).toBeDefined();
      expect(view.tiers.length).toBeGreaterThan(0);
      expect(view.clusterRows.length).toBeGreaterThan(0);
      expect(view.edges.length).toBeGreaterThan(0);
    }
  });

  it('every node id referenced in any view tier is an existing node id', () => {
    for (const view of viewList) {
      for (const tier of view.tiers) {
        for (const id of tier) {
          expect(nodeIds.has(id), `view "${view.id}" tier id "${id}" must be an existing node id`).toBe(true);
        }
      }
    }
  });

  it('every group referenced in clusterRows matches an existing node group', () => {
    const nodeGroups = new Set<DataFlowGroupId>(nodes.map(node => node.group));
    for (const view of viewList) {
      for (const row of view.clusterRows) {
        for (const group of row) {
          expect(nodeGroups.has(group), `view "${view.id}" clusterRows group "${group}" must back a node`).toBe(true);
        }
      }
    }
  });

  it('defaultView is a valid key of views', () => {
    expect(Object.keys(views)).toContain(dataNormalization.defaultView);
  });

  it('nodes cover all pipeline groups', () => {
    const groups = new Set<DataFlowGroupId>(nodes.map(node => node.group));
    for (const required of ['raw', 'cook', 'fact', 'derive', 'derived', 'mv'] as const) {
      expect(groups.has(required), `nodes must include a "${required}" group`).toBe(true);
    }
  });

  it('node ids are unique (single source of truth, no duplicates)', () => {
    const ids = nodes.map(node => node.id);
    expect(ids.length).toBe(nodeIds.size);
  });
});
