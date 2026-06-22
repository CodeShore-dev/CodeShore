import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TechIcon } from './TechIcon';

describe('TechIcon', () => {
  it('falls back to the label initial when no icon resolves', async () => {
    render(<TechIcon slugs={[]} label="React" hideIfNotFound={false} />);
    expect(await screen.findByText('R')).toBeInTheDocument();
  });

  it('renders nothing when no icon resolves and hideIfNotFound is set', async () => {
    const { container } = render(<TechIcon slugs={[]} label="React" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
