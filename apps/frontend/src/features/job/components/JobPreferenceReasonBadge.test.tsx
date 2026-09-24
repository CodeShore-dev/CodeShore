import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JobPreferenceReasonBadge } from './JobPreferenceReasonBadge';

describe('JobPreferenceReasonBadge (Requirement 7.7)', () => {
  it('renders the reason name when given one', () => {
    render(<JobPreferenceReasonBadge reason="技能已符合" />);

    expect(screen.getByText('技能已符合')).toBeInTheDocument();
  });

  it('renders nothing when reason is undefined', () => {
    const { container } = render(<JobPreferenceReasonBadge />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when reason is an empty string', () => {
    const { container } = render(<JobPreferenceReasonBadge reason="" />);

    expect(container).toBeEmptyDOMElement();
  });
});
