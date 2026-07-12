import { describe, expect, it } from 'vitest';

import { type CurationFlowGroupId, keywordCurationFlow } from './keywordCurationFlow';

describe('keywordCurationFlow', () => {
  const { nodes, views } = keywordCurationFlow;
  const nodeIds = new Set(nodes.map(node => node.id));
  const view = views.flow;

  it('every edge references existing node ids (edge integrity)', () => {
    for (const edge of view.edges) {
      expect(nodeIds.has(edge.from), `edge.from "${edge.from}" must be an existing node id`).toBe(true);
      expect(nodeIds.has(edge.to), `edge.to "${edge.to}" must be an existing node id`).toBe(true);
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

  it('the flow view is non-empty', () => {
    expect(view.tiers.length).toBeGreaterThan(0);
    expect(view.clusterRows.length).toBeGreaterThan(0);
    expect(view.edges.length).toBeGreaterThan(0);
  });

  it('every node id referenced in the view tiers is an existing node id', () => {
    for (const tier of view.tiers) {
      for (const id of tier) {
        expect(nodeIds.has(id), `tier id "${id}" must be an existing node id`).toBe(true);
      }
    }
  });

  it('every group referenced in clusterRows matches an existing node group', () => {
    const nodeGroups = new Set<CurationFlowGroupId>(nodes.map(node => node.group));
    for (const row of view.clusterRows) {
      for (const group of row) {
        expect(nodeGroups.has(group), `clusterRows group "${group}" must back a node`).toBe(true);
      }
    }
  });

  it('defaultView is a valid key of views', () => {
    expect(Object.keys(views)).toContain(keywordCurationFlow.defaultView);
  });

  it('the graph branches from classify into exactly the 3 decision paths', () => {
    const fromClassify = view.edges.filter(edge => edge.from === 'classify');
    expect(fromClassify.map(edge => edge.to).sort()).toEqual(
      ['commitKeywordBin', 'commitMapping', 'validateAndCommitNewTech'].sort(),
    );
  });

  it('node ids are unique (single source of truth, no duplicates)', () => {
    const ids = nodes.map(node => node.id);
    expect(ids.length).toBe(nodeIds.size);
  });
});
