import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { PUBLIC_PATHS, routeConfig } from './router';

// Router-level test (task 2.1, requirement 1.1-1.4): asserts on the real
// route table's nesting/guard placement via react-router's `matchRoutes`,
// rather than rendering the full app (whose job/company pages fetch live
// data). A regression that re-nests /jobs or /companies under
// ProtectedRoute -- or that accidentally loosens /keywords or the admin
// routes -- is caught here.
function guardChainFor(path: string) {
  const matches = matchRoutes(routeConfig, path) ?? [];
  return matches.map(match => {
    const element = match.route.element;
    return typeof element === 'object' && element !== null && 'type' in element
      ? element.type
      : undefined;
  });
}

describe('routeConfig (guest access, req 1.1-1.4)', () => {
  it('documents /jobs and /companies as public in PUBLIC_PATHS', () => {
    expect(PUBLIC_PATHS).toContain('/jobs');
    expect(PUBLIC_PATHS).toContain('/companies');
  });

  it('does not nest /jobs under ProtectedRoute', () => {
    const chain = guardChainFor('/jobs');
    expect(chain).not.toContain(ProtectedRoute);
  });

  it('does not nest /companies under ProtectedRoute', () => {
    const chain = guardChainFor('/companies');
    expect(chain).not.toContain(ProtectedRoute);
  });
});

describe('routeConfig (previously-authenticated routes unaffected)', () => {
  it('keeps /keywords nested under ProtectedRoute', () => {
    const chain = guardChainFor('/keywords');
    expect(chain).toContain(ProtectedRoute);
  });

  it('keeps /admin/jobs nested under ProtectedRoute and AdminRoute', () => {
    const chain = guardChainFor('/admin/jobs');
    expect(chain).toContain(ProtectedRoute);
    expect(chain).toContain(AdminRoute);
  });

  it('keeps /admin/ai-suggestions nested under ProtectedRoute and AdminRoute', () => {
    const chain = guardChainFor('/admin/ai-suggestions');
    expect(chain).toContain(ProtectedRoute);
    expect(chain).toContain(AdminRoute);
  });
});
