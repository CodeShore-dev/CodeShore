import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('../service', () => ({
  fetchMethodologySql: vi.fn().mockResolvedValue({}),
}));

import { methodologySections } from '../content/sections';
import { MethodologyPage } from './MethodologyPage';

describe('MethodologyPage', () => {
  it('renders the heading, content sections, and SQL section (req 8.3)', () => {
    renderWithProviders(<MethodologyPage />);

    expect(screen.getByText('公開透明')).toBeInTheDocument();
    expect(screen.getByText('資料來源 SQL')).toBeInTheDocument();
    // First content section title from the reused content module.
    expect(
      screen.getByText(methodologySections[0].title),
    ).toBeInTheDocument();
  });

  it('gives each section an id for hash deep-linking (req 8.2)', () => {
    const { container } = renderWithProviders(<MethodologyPage />);
    expect(
      container.querySelector(`#${methodologySections[0].id}`),
    ).not.toBeNull();
  });
});
