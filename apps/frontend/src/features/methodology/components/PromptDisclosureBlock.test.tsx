import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PromptDisclosureBlock } from './PromptDisclosureBlock';

describe('PromptDisclosureBlock', () => {
  it('displays label, toolName, full system prompt text, and pretty-printed schema JSON', () => {
    const inputSchema = {
      type: 'object',
      properties: {
        techId: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['techId'],
    };

    render(
      <PromptDisclosureBlock
        label="關鍵字對應技術"
        toolName="map_keyword_to_tech"
        systemPrompt="你是一個負責將關鍵字對應到既有技術條目的助理，請根據提供的關鍵字與候選技術清單，回傳最合適的對應結果。"
        inputSchema={inputSchema}
      />,
    );

    expect(screen.getByText('關鍵字對應技術')).toBeInTheDocument();
    expect(screen.getByText('map_keyword_to_tech')).toBeInTheDocument();
    expect(
      screen.getByText(
        '你是一個負責將關鍵字對應到既有技術條目的助理，請根據提供的關鍵字與候選技術清單，回傳最合適的對應結果。',
      ),
    ).toBeInTheDocument();

    const expectedSchemaJson = JSON.stringify(inputSchema, null, 2);
    expect(
      screen.getByText(expectedSchemaJson, {
        normalizer: text => text,
      }),
    ).toBeInTheDocument();
  });
});
