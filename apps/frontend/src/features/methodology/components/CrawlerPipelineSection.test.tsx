import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CrawlerPipelineSection } from './CrawlerPipelineSection';

// TechIcon fetches brand icons over the network; stub it out in tests.
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: () => null,
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
