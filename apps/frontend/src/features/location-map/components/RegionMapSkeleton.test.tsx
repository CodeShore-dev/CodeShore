import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RegionMapSkeleton } from './RegionMapSkeleton';

/**
 * task 6.4 — 骨架屏遵循 frontend-standards.md 的規則：
 * `bg-[#001f2a]/[0.08]` + `animate-pulse`，外觀比照地圖畫布比例
 * （非 JobCardSkeleton 的文字列形狀）。
 */
describe('RegionMapSkeleton', () => {
  it('renders an animate-pulse skeleton root', () => {
    render(<RegionMapSkeleton />);
    const root = screen.getByTestId('region-map-skeleton');
    expect(root.className).toContain('animate-pulse');
  });

  it('uses the established skeleton color token on its placeholder blocks', () => {
    render(<RegionMapSkeleton />);
    const root = screen.getByTestId('region-map-skeleton');
    const blocks = root.querySelectorAll('[class*="bg-[#001f2a]/[0.08]"]');
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('renders a map-shaped placeholder box (not a job-card text-line shape)', () => {
    render(<RegionMapSkeleton />);
    const root = screen.getByTestId('region-map-skeleton');
    const mapBox = root.querySelector('[class*="aspect-"]');
    expect(mapBox).not.toBeNull();
  });
});
