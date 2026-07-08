import { describe, expect, it } from 'vitest';

import {
  INPUT_SCHEMA as KEYWORD_MAPPING_INPUT_SCHEMA,
  SYSTEM_PROMPT as KEYWORD_MAPPING_SYSTEM_PROMPT,
  TOOL_NAME as KEYWORD_MAPPING_TOOL_NAME,
} from './generators/keyword-mapping.generator';
import {
  INPUT_SCHEMA as LOCATION_MAPPING_INPUT_SCHEMA,
  SYSTEM_PROMPT as LOCATION_MAPPING_SYSTEM_PROMPT,
  TOOL_NAME as LOCATION_MAPPING_TOOL_NAME,
} from './generators/location-mapping.generator';
import {
  DESCRIPTION_PATTERN_INPUT_SCHEMA,
  DESCRIPTION_PATTERN_SYSTEM_PROMPT,
  DESCRIPTION_PATTERN_TOOL_NAME,
  KEYWORD_NOISE_INPUT_SCHEMA,
  KEYWORD_NOISE_SYSTEM_PROMPT,
  KEYWORD_NOISE_TOOL_NAME,
} from './generators/noise-detection.generator';
import {
  INPUT_SCHEMA as TECH_DICTIONARY_INPUT_SCHEMA,
  SYSTEM_PROMPT as TECH_DICTIONARY_SYSTEM_PROMPT,
  TOOL_NAME as TECH_DICTIONARY_TOOL_NAME,
} from './generators/tech-dictionary.generator';
import {
  INPUT_SCHEMA as TECH_HIERARCHY_INPUT_SCHEMA,
  SYSTEM_PROMPT as TECH_HIERARCHY_SYSTEM_PROMPT,
  TOOL_NAME as TECH_HIERARCHY_TOOL_NAME,
} from './generators/tech-hierarchy.generator';
import { getWorkflowInfo, WorkflowInfo } from './workflow-info';

/**
 * Looks up a workflow's steps by id without a non-null assertion: builds a
 * `Record` (same approach the "4-vs-2 steps" test below uses) and indexes
 * into it, which TypeScript narrows to the value type directly since every
 * `AiSuggestionWorkflow` key is always present.
 */
function stepsOf(workflow: WorkflowInfo['workflow']) {
  const byWorkflow: Record<string, WorkflowInfo> = Object.fromEntries(
    getWorkflowInfo().map(w => [w.workflow, w]),
  );
  return byWorkflow[workflow].steps;
}

// Proves the "single source of truth, cannot drift" contract: this test
// imports the exact same generator-file constants `getWorkflowInfo()`
// itself imports, and asserts strict equality (not just "is a non-empty
// string") -- if a generator's prompt/schema ever changes without
// `workflow-info.ts` being updated to match, these `toBe`/`toEqual`
// assertions catch it because both sides re-import the same constant.
describe('getWorkflowInfo', () => {
  it('returns exactly 5 workflow entries, one per AiSuggestionWorkflow', () => {
    const info = getWorkflowInfo();
    expect(info).toHaveLength(5);
    expect(info.map(w => w.workflow)).toEqual([
      'keyword_mapping',
      'tech_dictionary',
      'tech_hierarchy',
      'location_mapping',
      'noise_detection',
    ]);
  });

  it('every workflow has a non-empty Chinese label', () => {
    for (const workflow of getWorkflowInfo()) {
      expect(workflow.label.length).toBeGreaterThan(0);
    }
  });

  it('4 of the 5 workflows have exactly one step; noise_detection has two', () => {
    const info = getWorkflowInfo();
    const byWorkflow = Object.fromEntries(info.map(w => [w.workflow, w]));

    expect(byWorkflow['keyword_mapping'].steps).toHaveLength(1);
    expect(byWorkflow['tech_dictionary'].steps).toHaveLength(1);
    expect(byWorkflow['tech_hierarchy'].steps).toHaveLength(1);
    expect(byWorkflow['location_mapping'].steps).toHaveLength(1);
    expect(byWorkflow['noise_detection'].steps).toHaveLength(2);
  });

  it('keyword_mapping step matches the real generator constants exactly', () => {
    const [step] = stepsOf('keyword_mapping');
    expect(step.toolName).toBe(KEYWORD_MAPPING_TOOL_NAME);
    expect(step.systemPrompt).toBe(KEYWORD_MAPPING_SYSTEM_PROMPT);
    expect(step.inputSchema).toEqual(KEYWORD_MAPPING_INPUT_SCHEMA);
  });

  it('tech_dictionary step matches the real generator constants exactly', () => {
    const [step] = stepsOf('tech_dictionary');
    expect(step.toolName).toBe(TECH_DICTIONARY_TOOL_NAME);
    expect(step.systemPrompt).toBe(TECH_DICTIONARY_SYSTEM_PROMPT);
    expect(step.inputSchema).toEqual(TECH_DICTIONARY_INPUT_SCHEMA);
  });

  it('tech_hierarchy step matches the real generator constants exactly', () => {
    const [step] = stepsOf('tech_hierarchy');
    expect(step.toolName).toBe(TECH_HIERARCHY_TOOL_NAME);
    expect(step.systemPrompt).toBe(TECH_HIERARCHY_SYSTEM_PROMPT);
    expect(step.inputSchema).toEqual(TECH_HIERARCHY_INPUT_SCHEMA);
  });

  it('location_mapping step matches the real generator constants exactly', () => {
    const [step] = stepsOf('location_mapping');
    expect(step.toolName).toBe(LOCATION_MAPPING_TOOL_NAME);
    expect(step.systemPrompt).toBe(LOCATION_MAPPING_SYSTEM_PROMPT);
    expect(step.inputSchema).toEqual(LOCATION_MAPPING_INPUT_SCHEMA);
  });

  it('noise_detection steps match both real generator sub-flow constants exactly', () => {
    const [keywordNoiseStep, descriptionPatternStep] =
      stepsOf('noise_detection');

    expect(keywordNoiseStep.toolName).toBe(KEYWORD_NOISE_TOOL_NAME);
    expect(keywordNoiseStep.systemPrompt).toBe(KEYWORD_NOISE_SYSTEM_PROMPT);
    expect(keywordNoiseStep.inputSchema).toEqual(KEYWORD_NOISE_INPUT_SCHEMA);

    expect(descriptionPatternStep.toolName).toBe(
      DESCRIPTION_PATTERN_TOOL_NAME,
    );
    expect(descriptionPatternStep.systemPrompt).toBe(
      DESCRIPTION_PATTERN_SYSTEM_PROMPT,
    );
    expect(descriptionPatternStep.inputSchema).toEqual(
      DESCRIPTION_PATTERN_INPUT_SCHEMA,
    );
  });
});
