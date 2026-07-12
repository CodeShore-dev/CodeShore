import { describe, expect, it } from 'vitest';

import {
  CLASSIFY_TOOL_INPUT_SCHEMA,
  SYSTEM_PROMPT,
  TOOL_NAME,
} from './llm-classifier';
import { getKeywordCurationWorkflowInfo } from './workflow-info';

// Proves the "single source of truth, cannot drift" contract: this test
// imports the exact same `llm-classifier.ts` constants
// `getKeywordCurationWorkflowInfo()` itself imports, and asserts strict
// equality (not just "is a non-empty string") -- if `llm-classifier.ts`'s
// prompt/schema/tool name ever changes without `workflow-info.ts` being
// updated to match, these `toBe`/`toEqual` assertions catch it (requirement
// 3.3).
describe('getKeywordCurationWorkflowInfo', () => {
  it('toolName matches llm-classifier.ts TOOL_NAME exactly', () => {
    const info = getKeywordCurationWorkflowInfo();
    expect(info.toolName).toBe(TOOL_NAME);
  });

  it('systemPrompt matches llm-classifier.ts SYSTEM_PROMPT exactly', () => {
    const info = getKeywordCurationWorkflowInfo();
    expect(info.systemPrompt).toBe(SYSTEM_PROMPT);
  });

  it('inputSchema matches llm-classifier.ts CLASSIFY_TOOL_INPUT_SCHEMA exactly', () => {
    const info = getKeywordCurationWorkflowInfo();
    expect(info.inputSchema).toEqual(CLASSIFY_TOOL_INPUT_SCHEMA);
  });

  it('returns exactly 3 paths: A, B, C', () => {
    const info = getKeywordCurationWorkflowInfo();
    expect(info.paths).toHaveLength(3);
    expect(info.paths.map(p => p.path)).toEqual(['A', 'B', 'C']);
  });

  it('every path has a non-empty label', () => {
    const info = getKeywordCurationWorkflowInfo();
    for (const path of info.paths) {
      expect(path.label.length).toBeGreaterThan(0);
    }
  });

  it('labels map to existing tech / new tech / keyword bin as specified', () => {
    const info = getKeywordCurationWorkflowInfo();
    const byPath = Object.fromEntries(info.paths.map(p => [p.path, p.label]));
    expect(byPath['A']).toBe('映射至既有技術條目');
    expect(byPath['B']).toBe('建立新技術條目');
    expect(byPath['C']).toBe('移入 keyword bin');
  });
});
