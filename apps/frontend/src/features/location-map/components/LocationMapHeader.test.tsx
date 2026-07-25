import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocationMapHeader } from './LocationMapHeader';

describe('LocationMapHeader', () => {
  it('renders the page title', () => {
    render(<LocationMapHeader />);

    expect(screen.getByRole('heading', { name: '職缺地圖' })).toBeInTheDocument();
  });

  it('no longer renders the 「目前檢視」 badge (technology view mode removed)', () => {
    render(<LocationMapHeader />);

    expect(screen.queryByText(/目前檢視/)).not.toBeInTheDocument();
  });
});
