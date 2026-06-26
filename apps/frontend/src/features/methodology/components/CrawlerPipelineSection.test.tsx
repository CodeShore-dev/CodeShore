import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CrawlerPipelineSection } from './CrawlerPipelineSection';

// TechIcon fetches brand icons over the network; stub it out in tests.
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: () => null,
}));

// Host-share statistics come from the backend; stub the hook with deterministic
// shares so the section renders real proportions without a network call.
const hostPercents: Record<string, number> = {
  '104.com.tw': 84,
  'cake.me': 16,
};
vi.mock('../../../hooks/useJobHostStatistics', () => ({
  useJobHostStatistics: () => ({
    isLoading: false,
    isError: false,
    byHost: {},
    percentFor: (host: string): number | undefined => hostPercents[host],
  }),
}));

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 互動節點按鈕的無障礙名稱即為其 label。
const nodeButtonName = (label: string): RegExp => new RegExp(`^${escapeRe(label)}$`);

describe('CrawlerPipelineSection', () => {
  it('提供 id="data-crawler" 與 scroll-mt-20 的深連結錨點', () => {
    const { container } = render(<CrawlerPipelineSection />);
    const section = container.querySelector('#data-crawler');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('scroll-mt-20');
  });

  it('首次渲染顯示預設（抓取流程）視角的節點', () => {
    render(<CrawlerPipelineSection />);
    expect(screen.getByRole('button', { name: nodeButtonName('Crawlee PuppeteerCrawler') })).toBeInTheDocument();
  });

  it('簡介以 get_job_host_statistics 的真實佔比呈現（取代寫死數據）', () => {
    const { container } = render(<CrawlerPipelineSection />);
    expect(container.textContent).toContain('104 人力銀行（約佔 84%）');
    expect(container.textContent).toContain('Cake（約佔 16%）');
    expect(container.textContent).not.toContain('54%');
    expect(container.textContent).not.toContain('28%');
  });

  it('來源節點詳情角色附上即時佔比', async () => {
    const user = userEvent.setup();
    render(<CrawlerPipelineSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('104 人力銀行') }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('公開職缺來源（約佔 84%）')).toBeInTheDocument();
  });

  it('點擊執行模式視角切換圖表並以 aria-pressed 反映選取狀態', async () => {
    const user = userEvent.setup();
    render(<CrawlerPipelineSection />);

    const toggle = screen.getByRole('group', { name: '切換視角' });
    const modesButton = within(toggle).getByRole('button', { name: '執行模式' });
    await user.click(modesButton);

    expect(modesButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: nodeButtonName('全量 fresh') })).toBeInTheDocument();
  });

  it('點擊互動節點開啟詳情面板並顯示其角色／用途', async () => {
    const user = userEvent.setup();
    render(<CrawlerPipelineSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('Stealth 反爬層') }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('反自動化偵測與穩定性')).toBeInTheDocument();
  });

  it('切換視角時清除既有選取（詳情面板關閉）', async () => {
    const user = userEvent.setup();
    render(<CrawlerPipelineSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('Stealth 反爬層') }));
    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    const toggle = screen.getByRole('group', { name: '切換視角' });
    await user.click(within(toggle).getByRole('button', { name: '執行模式' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('按 Escape 收合詳情面板', async () => {
    const user = userEvent.setup();
    render(<CrawlerPipelineSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('Stealth 反爬層') }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
