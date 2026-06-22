import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from './renderWithProviders';

// Smoke test proving the test infrastructure (jsdom + RTL + jest-dom matchers
// + provider wrapper) is wired correctly (task 1.4).
describe('test infrastructure', () => {
  it('renders a component within the provider wrapper', () => {
    renderWithProviders(<button type="button">投遞履歷</button>);

    expect(
      screen.getByRole('button', { name: '投遞履歷' }),
    ).toBeInTheDocument();
  });
});
