import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { cloudArchitecture } from '../content/cloudArchitecture';
import { useCloudArchitectureView } from './useCloudArchitectureView';

describe('useCloudArchitectureView', () => {
  it('initialises to the default view with no selection (req 3.5)', () => {
    const { result } = renderHook(() => useCloudArchitectureView());

    expect(result.current.view).toBe(cloudArchitecture.defaultView);
    expect(result.current.activeView).toBe(cloudArchitecture.views[cloudArchitecture.defaultView]);
    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.selectedNode).toBeNull();
  });

  it('setView switches the active view and clears a prior selection (req 3.1, 3.4)', () => {
    const { result } = renderHook(() => useCloudArchitectureView());

    act(() => {
      result.current.selectNode('cf-worker');
    });
    expect(result.current.selectedNodeId).toBe('cf-worker');

    act(() => {
      result.current.setView('cicd');
    });

    expect(result.current.view).toBe('cicd');
    expect(result.current.activeView).toBe(cloudArchitecture.views.cicd);
    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.selectedNode).toBeNull();
  });

  it('selectNode on an interactive node sets the selected node (req 4.1)', () => {
    const { result } = renderHook(() => useCloudArchitectureView());

    act(() => {
      result.current.selectNode('cf-worker');
    });

    expect(result.current.selectedNodeId).toBe('cf-worker');
    expect(result.current.selectedNode).toBe(cloudArchitecture.nodes.find(node => node.id === 'cf-worker') ?? null);
  });

  it('selectNode on an unknown id is a no-op (req 4.1)', () => {
    const { result } = renderHook(() => useCloudArchitectureView());

    act(() => {
      result.current.selectNode('does-not-exist');
    });

    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.selectedNode).toBeNull();
  });

  it('selecting another interactive node switches the selection; only one at a time (req 4.3)', () => {
    const { result } = renderHook(() => useCloudArchitectureView());

    act(() => {
      result.current.selectNode('cf-worker');
    });
    expect(result.current.selectedNodeId).toBe('cf-worker');

    act(() => {
      result.current.selectNode('aws-s3');
    });

    expect(result.current.selectedNodeId).toBe('aws-s3');
    expect(result.current.selectedNode).toBe(cloudArchitecture.nodes.find(node => node.id === 'aws-s3') ?? null);
  });

  it('clearSelection resets the selection (req 4.3)', () => {
    const { result } = renderHook(() => useCloudArchitectureView());

    act(() => {
      result.current.selectNode('cf-worker');
    });
    expect(result.current.selectedNodeId).toBe('cf-worker');

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.selectedNode).toBeNull();
  });
});
