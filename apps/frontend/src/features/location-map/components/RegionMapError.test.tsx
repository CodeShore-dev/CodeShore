import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RegionMapError } from './RegionMapError';

/**
 * task 6.4 — 錯誤狀態遵循 frontend-standards.md 的「空狀態固定結構」
 * （大 icon → 標題 → 說明文 → 操作按鈕），並提供 onRetry 重試操作
 * （對應 requirements.md 1.4）。
 */
describe('RegionMapError', () => {
  it('renders a title, description, and a retry button', () => {
    render(<RegionMapError onRetry={() => {}} />);

    expect(
      screen.getByRole('heading', { name: '地圖載入失敗' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/請稍後再試/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重試' })).toBeInTheDocument();
  });

  it('invokes onRetry exactly once when the retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<RegionMapError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: '重試' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
