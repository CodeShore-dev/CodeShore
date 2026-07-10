import { beforeEach, describe, expect, it } from 'vitest';

import type { AiRecommendation, CommitResult, CommittedChange } from './service';
import { INITIAL_CURATION_STATE, useCurationStore } from './curationStore';

const reset = () => useCurationStore.setState(INITIAL_CURATION_STATE);

const pathARecommendation: AiRecommendation = {
  path: 'A',
  matchedTech: { id: 'reactjs', label: 'React', category: 'framework' },
  confidence: 0.92,
  reasoning: 'strong lexical match',
  affectedJobCount: 12,
};

const successResult: CommitResult = {
  ok: true,
  changes: [
    {
      type: 'tech_keyword',
      details: { keyword: 'reactjs', techId: 'reactjs' },
      status: 'committed',
    },
  ],
};

const partialFailureChanges: CommittedChange[] = [
  {
    type: 'tech',
    details: { id: 'newtech' },
    status: 'committed',
  },
  {
    type: 'tech_parent',
    details: { parentId: 'newtech', childId: 'reactjs' },
    status: 'failed',
    error: 'constraint violation',
  },
];

const partialFailureResult: CommitResult = {
  ok: false,
  error: 'parent-child write failed',
  partialChanges: partialFailureChanges,
};

describe('useCurationStore', () => {
  beforeEach(reset);

  it('walks idle -> loading -> interrupted -> done', () => {
    useCurationStore.getState().startSession('reactjs');
    expect(useCurationStore.getState().sessionStatus).toBe('loading');
    expect(useCurationStore.getState().activeKeyword).toBe('reactjs');

    useCurationStore.getState().setInterrupted('thread-1', pathARecommendation);
    const interrupted = useCurationStore.getState();
    expect(interrupted.sessionStatus).toBe('interrupted');
    expect(interrupted.threadId).toBe('thread-1');
    expect(interrupted.interrupt).toBe(pathARecommendation);

    useCurationStore.getState().setDone(successResult);
    const done = useCurationStore.getState();
    expect(done.sessionStatus).toBe('done');
    expect(done.commitResult).toBe(successResult);
  });

  it('walks idle -> loading -> error', () => {
    useCurationStore.getState().startSession('vuejs');
    expect(useCurationStore.getState().sessionStatus).toBe('loading');

    useCurationStore.getState().setError('AI analysis failed');
    const errored = useCurationStore.getState();
    expect(errored.sessionStatus).toBe('error');
    expect(errored.errorMessage).toBe('AI analysis failed');
  });

  it('stores commitResult.partialChanges intact on a partial failure', () => {
    useCurationStore.getState().startSession('newtech-kw');
    useCurationStore
      .getState()
      .setInterrupted('thread-2', { path: 'C', reasoning: 'noise', affectedJobCount: 1 });

    useCurationStore.getState().setDone(partialFailureResult);

    const state = useCurationStore.getState();
    expect(state.sessionStatus).toBe('done');
    expect(state.commitResult).not.toBeNull();
    expect(state.commitResult?.ok).toBe(false);
    if (state.commitResult && state.commitResult.ok === false) {
      expect(state.commitResult.partialChanges).toEqual(partialFailureChanges);
      expect(state.commitResult.partialChanges).toHaveLength(2);
      expect(state.commitResult.partialChanges[0].status).toBe('committed');
      expect(state.commitResult.partialChanges[1].status).toBe('failed');
    }
  });

  it('resets to the initial idle state from a done session', () => {
    useCurationStore.getState().startSession('reactjs');
    useCurationStore.getState().setInterrupted('thread-1', pathARecommendation);
    useCurationStore.getState().setDone(successResult);

    useCurationStore.getState().reset();

    expect(useCurationStore.getState()).toMatchObject(INITIAL_CURATION_STATE);
  });

  it('resets to the initial idle state from an error session', () => {
    useCurationStore.getState().startSession('vuejs');
    useCurationStore.getState().setError('boom');

    useCurationStore.getState().reset();

    expect(useCurationStore.getState()).toMatchObject(INITIAL_CURATION_STATE);
  });

  it('setSessionLoading flips status back to loading without touching activeKeyword', () => {
    useCurationStore.getState().startSession('reactjs');
    useCurationStore.getState().setError('network blip');
    expect(useCurationStore.getState().sessionStatus).toBe('error');

    useCurationStore.getState().setSessionLoading();

    const state = useCurationStore.getState();
    expect(state.sessionStatus).toBe('loading');
    expect(state.activeKeyword).toBe('reactjs');
  });

  it('clears stale threadId/interrupt/commitResult/errorMessage when starting a new session', () => {
    useCurationStore.getState().startSession('reactjs');
    useCurationStore.getState().setInterrupted('thread-1', pathARecommendation);
    useCurationStore.getState().setDone(successResult);

    useCurationStore.getState().startSession('vuejs');

    const state = useCurationStore.getState();
    expect(state.activeKeyword).toBe('vuejs');
    expect(state.sessionStatus).toBe('loading');
    expect(state.threadId).toBeNull();
    expect(state.interrupt).toBeNull();
    expect(state.commitResult).toBeNull();
    expect(state.errorMessage).toBeNull();
  });
});
