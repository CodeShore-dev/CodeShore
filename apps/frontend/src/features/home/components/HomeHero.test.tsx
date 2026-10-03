import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeHero } from './HomeHero';

vi.mock('../hooks/useHomeData', () => ({
  useHomeData: () => ({ jobCountText: { total: '1,234' } }),
}));

// Hero 文案輪播（issue #20）：間隔 10 秒，兩行同步換，卸載時清掉 timer。
describe('HomeHero', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the first pair before 10 seconds and switches at 10 seconds', () => {
    vi.useFakeTimers();
    render(<HomeHero />);

    expect(screen.getByText('搞懂現在缺什麼技術')).toBeInTheDocument();
    expect(screen.getByText('投履歷的入口')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(9999);
    });
    expect(screen.getByText('搞懂現在缺什麼技術')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('抓住薪資甜蜜點')).toBeInTheDocument();
    expect(screen.getByText('人才媒合的地方')).toBeInTheDocument();
  });

  it('cycles back to the first pair after the third one', () => {
    vi.useFakeTimers();
    render(<HomeHero />);

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText('偷看大公司的技術清單')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('搞懂現在缺什麼技術')).toBeInTheDocument();
  });

  it('clears the interval on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<HomeHero />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    clearIntervalSpy.mockRestore();
  });

  // 分段進度（issue #32）：每則文案一段，目前段倒數填滿，已播段維持填滿，未播段保持空白。
  it('renders one decorative segment per cycle item with a timed fill on the active one', () => {
    vi.useFakeTimers();
    render(<HomeHero />);

    expect(screen.getByTestId('hero-progress-track')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('hero-progress-segment-0')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('hero-progress-segment-1')).toHaveAttribute('data-state', 'pending');
    expect(screen.getByTestId('hero-progress-segment-2')).toHaveAttribute('data-state', 'pending');
    expect(screen.getByTestId('hero-progress-bar')).toHaveStyle({
      animationDuration: '10000ms',
    });
  });

  it('fills played segments and advances the active fill when the text cycles', () => {
    vi.useFakeTimers();
    render(<HomeHero />);

    const firstBar = screen.getByTestId('hero-progress-bar');

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByTestId('hero-progress-segment-0')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('hero-progress-segment-1')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('hero-progress-segment-2')).toHaveAttribute('data-state', 'pending');

    const secondBar = screen.getByTestId('hero-progress-bar');
    expect(secondBar).not.toBe(firstBar);
    expect(secondBar).toHaveStyle({ animationDuration: '10000ms' });
  });

  it('empties the segments again when the cycle wraps to the first item', () => {
    vi.useFakeTimers();
    render(<HomeHero />);

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(screen.getByTestId('hero-progress-segment-0')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('hero-progress-segment-1')).toHaveAttribute('data-state', 'pending');
    expect(screen.getByTestId('hero-progress-segment-2')).toHaveAttribute('data-state', 'pending');
  });
});
