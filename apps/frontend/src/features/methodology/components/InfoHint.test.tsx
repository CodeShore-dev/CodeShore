import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { MetricKey } from '../content/types';
import { metricExplanations } from '../content/metrics';
import { InfoHint } from './InfoHint';

describe('InfoHint', () => {
  it('opens the popover with the explanation title on click', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <InfoHint metric="home.statRow" />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole('button', { name: '查看此區資料如何計算' }),
    );

    expect(
      screen.getByText(metricExplanations['home.statRow'].title),
    ).toBeInTheDocument();
  });

  it('renders nothing for an unknown metric', () => {
    const { container } = render(
      <MemoryRouter>
        <InfoHint metric={'does.not.exist' as MetricKey} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
