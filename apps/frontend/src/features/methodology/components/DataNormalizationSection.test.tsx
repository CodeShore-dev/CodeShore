import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataNormalizationSection } from './DataNormalizationSection';

// TechIcon fetches brand icons over the network; stub it out in tests.
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: () => null,
}));

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 互動節點按鈕的無障礙名稱即為其 label。
const nodeButtonName = (label: string): RegExp => new RegExp(`^${escapeRe(label)}$`);

describe('DataNormalizationSection', () => {
  it('提供 id="data-normalization" 與 scroll-mt-20 的深連結錨點', () => {
    const { container } = render(<DataNormalizationSection />);
    const section = container.querySelector('#data-normalization');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('scroll-mt-20');
  });

  it('首次渲染顯示預設（寫入時拆表）視角的節點', () => {
    render(<DataNormalizationSection />);
    expect(screen.getByRole('button', { name: nodeButtonName('一筆職缺') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: nodeButtonName('職缺主表') })).toBeInTheDocument();
  });

  it('點擊事後加工視角切換圖表並以 aria-pressed 反映選取狀態', async () => {
    const user = userEvent.setup();
    render(<DataNormalizationSection />);

    const toggle = screen.getByRole('group', { name: '切換視角' });
    const processButton = within(toggle).getByRole('button', { name: '事後加工' });
    await user.click(processButton);

    expect(processButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: nodeButtonName('技術映射') })).toBeInTheDocument();
  });

  it('點擊互動節點開啟詳情面板並顯示其角色／用途', async () => {
    const user = userEvent.setup();
    render(<DataNormalizationSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('薪資解析') }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('薪資字串 → 結構化欄位')).toBeInTheDocument();
  });

  it('切換視角時清除既有選取（詳情面板關閉）', async () => {
    const user = userEvent.setup();
    render(<DataNormalizationSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('薪資解析') }));
    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    const toggle = screen.getByRole('group', { name: '切換視角' });
    await user.click(within(toggle).getByRole('button', { name: '事後加工' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('按 Escape 收合詳情面板', async () => {
    const user = userEvent.setup();
    render(<DataNormalizationSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('薪資解析') }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
