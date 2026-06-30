import { describe, expect, it } from 'vitest';

import { type DbGroupId, type DbView, databaseSchema } from './databaseSchema';

describe('databaseSchema', () => {
  const { nodes, views } = databaseSchema;
  const nodeIds = new Set(nodes.map(node => node.id));
  const viewList: readonly DbView[] = [views.table, views.matview, views.function];

  it('every edge in all views references existing node ids (edge integrity)', () => {
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
        expect((node.detail?.role ?? '').trim().length).toBeGreaterThan(0);
        expect((node.detail?.usage ?? '').trim().length).toBeGreaterThan(0);
      }
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
    const nodeGroups = new Set<DbGroupId>(nodes.map(node => node.group));
    for (const view of viewList) {
      for (const row of view.clusterRows) {
        for (const group of row) {
          expect(nodeGroups.has(group), `view "${view.id}" clusterRows group "${group}" must back a node`).toBe(true);
        }
      }
    }
  });

  it('each edge endpoint in a view is also present in that view tiers (no orphan edges)', () => {
    for (const view of viewList) {
      const tierIds = new Set(view.tiers.flat());
      for (const edge of view.edges) {
        expect(tierIds.has(edge.from), `view "${view.id}" edge.from "${edge.from}" must appear in its tiers`).toBe(
          true,
        );
        expect(tierIds.has(edge.to), `view "${view.id}" edge.to "${edge.to}" must appear in its tiers`).toBe(true);
      }
    }
  });

  it('nodes cover all schema groups', () => {
    const groups = new Set<DbGroupId>(nodes.map(node => node.group));
    for (const required of [
      'job',
      'tech',
      'location',
      'pref',
      'source',
      'mv-salary',
      'mv-job',
      'mv-tech',
      'mv-location',
      'fn',
    ] as const) {
      expect(groups.has(required), `nodes must include a "${required}" group`).toBe(true);
    }
  });

  it('node ids are unique (single source of truth, no duplicates)', () => {
    const ids = nodes.map(node => node.id);
    expect(ids.length).toBe(nodeIds.size);
  });

  it('defaultView is a valid key of views', () => {
    expect(Object.keys(views)).toContain(databaseSchema.defaultView);
  });

  it('every refresh_mv_* function refreshes exactly one matching materialized view', () => {
    const refreshFns = nodes.filter(node => node.id.startsWith('refresh_mv_'));
    expect(refreshFns.length).toBeGreaterThan(0);
    for (const fn of refreshFns) {
      const targetMv = fn.id.replace(/^refresh_/, '');
      const edge = views.function.edges.find(e => e.from === fn.id && e.to === targetMv);
      expect(edge, `"${fn.id}" must have an edge to "${targetMv}" in the function view`).toBeDefined();
      expect(nodeIds.has(targetMv), `target mv "${targetMv}" must exist as a node`).toBe(true);
    }
  });
});
