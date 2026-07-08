// `LocationMappingGenerator` calls `fetchLocationAnomalyJobs` directly (not
// constructor injected), mirroring `service.spec.ts`'s existing convention
// for mocking `@codeshore/data-utils` at the module boundary (there for
// `refreshAllMaterializedViews`, here for `fetchLocationAnomalyJobs`).
vi.mock('@codeshore/data-utils', () => ({
  fetchLocationAnomalyJobs: vi.fn(),
}));

import { fetchLocationAnomalyJobs } from '@codeshore/data-utils';

import {
  LOW_CONFIDENCE_THRESHOLD,
  LocationMappingGenerator,
} from './location-mapping.generator';

function makeAnomalyJobs(rows: Array<{ location: string }>) {
  return { result: rows, count: rows.length, searchParams: '' };
}

function makeLocationGroupService(rows: Array<{ id: string }> = []) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: rows, count: rows.length, searchParams: '' }) };
}

function makeSuggestionCreator(
  outcomes: Array<'created' | 'duplicate' | 'error'> | 'created' | 'duplicate' | 'error' = 'created',
) {
  const results: Record<string, unknown> = {
    created: { outcome: 'created', record: {} },
    duplicate: {
      outcome: 'duplicate',
      targetTable: 'location_group_location',
      workflow: 'location_mapping',
      targetKey: {},
    },
    error: { outcome: 'error', error: { message: 'db unavailable' } },
  };

  const createSuggestion = vi.fn();
  if (Array.isArray(outcomes)) {
    outcomes.forEach(outcome => createSuggestion.mockResolvedValueOnce(results[outcome]));
  } else {
    createSuggestion.mockResolvedValue(results[outcomes]);
  }

  return { createSuggestion };
}

describe('LocationMappingGenerator.generate', () => {
  beforeEach(() => {
    vi.mocked(fetchLocationAnomalyJobs).mockReset();
  });

  it('creates one suggestion for an unmapped location matched to an existing group, with correct target_key/payload/affectedCount', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '台北市信義區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '台北市信義區',
              matchedGroupId: 'taipei',
              confidence: 0.9,
              proposedNewGroupId: null,
              reasoning: 'Xinyi District is part of Taipei',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result).toEqual({
      created: 1,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledTimes(1);
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledWith({
      target_table: 'location_group_location',
      workflow: 'location_mapping',
      action: 'insert',
      target_key: { location_group: 'taipei', location: '台北市信義區' },
      payload: { location_group: 'taipei', location: '台北市信義區' },
      evidence: expect.objectContaining({
        affectedCount: 1,
        reasoning: 'Xinyi District is part of Taipei',
      }),
    });
  });

  it('creates two linked suggestions (new group + new mapping) sharing the same correlationId when no existing group fits', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '新竹科學園區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '新竹科學園區',
              matchedGroupId: null,
              proposedNewGroupId: '新竹縣竹北市',
              reasoning: 'No existing group covers Hsinchu Science Park',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result).toEqual({
      created: 2,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledTimes(2);

    const [groupCall, mappingCall] = suggestionCreator.createSuggestion.mock.calls.map(
      call => call[0],
    );
    expect(groupCall).toEqual({
      target_table: 'location_group',
      workflow: 'location_mapping',
      action: 'insert',
      target_key: { id: '新竹縣竹北市' },
      payload: { id: '新竹縣竹北市' },
      evidence: expect.objectContaining({
        affectedCount: 1,
        reasoning: 'No existing group covers Hsinchu Science Park',
        needsVerification: false,
        correlationId: expect.any(String),
      }),
    });
    expect(mappingCall).toEqual({
      target_table: 'location_group_location',
      workflow: 'location_mapping',
      action: 'insert',
      target_key: { location_group: '新竹縣竹北市', location: '新竹科學園區' },
      payload: { location_group: '新竹縣竹北市', location: '新竹科學園區' },
      evidence: expect.objectContaining({
        affectedCount: 1,
        reasoning: 'No existing group covers Hsinchu Science Park',
        correlationId: expect.any(String),
      }),
    });
    // Both halves of the pair must share the exact same correlationId.
    expect(groupCall.evidence.correlationId).toBe(mappingCall.evidence.correlationId);
  });

  it('computes affectedCount as the number of anomalous jobs sharing the exact same location string', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([
        { location: '台北市信義區' },
        { location: '台北市信義區' },
        { location: '新竹科學園區' },
      ]) as any,
    );
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '台北市信義區',
              matchedGroupId: 'taipei',
              confidence: 0.9,
              proposedNewGroupId: null,
              reasoning: 'Xinyi District is part of Taipei',
            },
            {
              location: '新竹科學園區',
              matchedGroupId: null,
              proposedNewGroupId: 'hsinchu',
              reasoning: 'No existing group covers Hsinchu Science Park',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    await generator.generate();

    const calls = suggestionCreator.createSuggestion.mock.calls.map(call => call[0]);
    const taipeiMappingCall = calls.find(
      call => call.target_table === 'location_group_location' && call.payload['location_group'] === 'taipei',
    );
    const hsinchuGroupCall = calls.find(call => call.target_table === 'location_group');

    expect(taipeiMappingCall.evidence.affectedCount).toBe(2);
    expect(hsinchuGroupCall.evidence.affectedCount).toBe(1);

    // The LLM only ever sees the 2 distinct location strings, not 3 raw rows.
    const request = llmClient.completeStructured.mock.calls[0][0];
    expect(request.input.distinctLocations).toEqual(
      expect.arrayContaining(['台北市信義區', '新竹科學園區']),
    );
    expect(request.input.distinctLocations).toHaveLength(2);
  });

  it('counts each half of a paired no-match proposal independently when one is a duplicate and the other is created', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '新竹科學園區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([]);
    // First call (new location_group) is a duplicate; second call (the
    // paired location_group_location mapping) succeeds.
    const suggestionCreator = makeSuggestionCreator(['duplicate', 'created']);
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '新竹科學園區',
              matchedGroupId: null,
              proposedNewGroupId: 'hsinchu',
              reasoning: 'No existing group covers Hsinchu Science Park',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result).toEqual({
      created: 1,
      skippedDuplicates: 1,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
    expect(suggestionCreator.createSuggestion).toHaveBeenCalledTimes(2);
  });

  it('records one error and creates zero suggestions, without throwing, when the single LLM call fails', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '台北市信義區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: false,
        error: 'Anthropic API request failed: timeout',
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [{ message: expect.stringContaining('timeout') }],
    });
    expect(suggestionCreator.createSuggestion).not.toHaveBeenCalled();
  });

  it('never calls the LLM and produces an empty result when there are no unmapped location anomalies', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(makeAnomalyJobs([]) as any);
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = { completeStructured: vi.fn() };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(llmClient.completeStructured).not.toHaveBeenCalled();
    expect(locationGroupService.fetchAll).not.toHaveBeenCalled();
    expect(result).toEqual({
      created: 0,
      skippedDuplicates: 0,
      skippedNoMatch: 0,
      skippedConflict: 0,
      errors: [],
    });
  });

  it('flags a matched-existing-group suggestion with needsVerification=true when confidence is below the threshold', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '台北市信義區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '台北市信義區',
              matchedGroupId: 'taipei',
              confidence: LOW_CONFIDENCE_THRESHOLD - 0.1,
              proposedNewGroupId: null,
              reasoning: 'Weak match',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    await generator.generate();

    const call = suggestionCreator.createSuggestion.mock.calls[0][0];
    expect(call.evidence.confidence).toBe(LOW_CONFIDENCE_THRESHOLD - 0.1);
    expect(call.evidence.needsVerification).toBe(true);
  });

  it('reflects the LLM confidence and sets needsVerification=false for a matched-existing-group suggestion at/above the threshold', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '台北市信義區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '台北市信義區',
              matchedGroupId: 'taipei',
              confidence: LOW_CONFIDENCE_THRESHOLD,
              proposedNewGroupId: null,
              reasoning: 'Xinyi District is part of Taipei',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    await generator.generate();

    const call = suggestionCreator.createSuggestion.mock.calls[0][0];
    // Boundary: exactly at the threshold is "at or above", not "below".
    expect(call.evidence.confidence).toBe(LOW_CONFIDENCE_THRESHOLD);
    expect(call.evidence.needsVerification).toBe(false);
  });

  it('flags a new-group proposal with needsVerification=true and an appended note when proposedNewGroupId is not in the standard 縣市+鄉鎮市區 format', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '新竹科學園區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '新竹科學園區',
              matchedGroupId: null,
              // Not the standard "<縣市><鄉鎮市區>" format.
              proposedNewGroupId: 'hsinchu',
              reasoning: 'No existing group covers Hsinchu Science Park',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    await generator.generate();

    const calls = suggestionCreator.createSuggestion.mock.calls.map(call => call[0]);
    const groupCall = calls.find(call => call.target_table === 'location_group');
    const mappingCall = calls.find(
      call => call.target_table === 'location_group_location',
    );
    expect(groupCall.evidence.needsVerification).toBe(true);
    expect(groupCall.evidence.reasoning).toContain('縣市+鄉鎮市區');
    // The paired mapping suggestion writes the same non-conforming id, so it
    // must carry the same flag -- otherwise a reviewer could approve the
    // unflagged half without ever seeing the format warning.
    expect(mappingCall.evidence.needsVerification).toBe(true);
    expect(mappingCall.evidence.reasoning).toContain('縣市+鄉鎮市區');
  });

  it('does not flag needsVerification when proposedNewGroupId already follows the standard 縣市+鄉鎮市區 format', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '新竹科學園區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '新竹科學園區',
              matchedGroupId: null,
              proposedNewGroupId: '新竹縣竹北市',
              reasoning: 'No existing group covers Hsinchu Science Park',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    await generator.generate();

    const calls = suggestionCreator.createSuggestion.mock.calls.map(call => call[0]);
    const groupCall = calls.find(call => call.target_table === 'location_group');
    const mappingCall = calls.find(
      call => call.target_table === 'location_group_location',
    );
    expect(groupCall.evidence.needsVerification).toBe(false);
    expect(groupCall.evidence.reasoning).toBe(
      'No existing group covers Hsinchu Science Park',
    );
    expect(mappingCall.evidence.needsVerification).toBe(false);
    expect(mappingCall.evidence.reasoning).toBe(
      'No existing group covers Hsinchu Science Park',
    );
  });

  it('records an error and creates no suggestion when the LLM returns neither matchedGroupId nor proposedNewGroupId', async () => {
    vi.mocked(fetchLocationAnomalyJobs).mockResolvedValue(
      makeAnomalyJobs([{ location: '台北市信義區' }]) as any,
    );
    const locationGroupService = makeLocationGroupService([{ id: 'taipei' }]);
    const suggestionCreator = makeSuggestionCreator('created');
    const llmClient = {
      completeStructured: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          proposals: [
            {
              location: '台北市信義區',
              matchedGroupId: null,
              proposedNewGroupId: null,
              reasoning: 'ambiguous',
            },
          ],
        },
      }),
    };

    const generator = new LocationMappingGenerator(
      llmClient as any,
      locationGroupService as any,
      suggestionCreator as any,
    );

    const result = await generator.generate();

    expect(suggestionCreator.createSuggestion).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.skippedNoMatch).toBe(0);
    expect(result.errors).toEqual([
      { message: expect.stringContaining('台北市信義區') },
    ]);
  });
});
