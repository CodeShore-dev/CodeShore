import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseSchemaSection } from './DatabaseSchemaSection';

// TechIcon fetches brand icons over the network; stub it out in tests.
vi.mock('../../../components/TechIcon', () => ({
  TechIcon: () => null,
}));

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 互動節點按鈕的無障礙名稱即為其物件名稱（label）。
const nodeButtonName = (label: string): RegExp => new RegExp(`^${escapeRe(label)}$`);

describe('DatabaseSchemaSection', () => {
  it('提供 id="database" 與 scroll-mt-20 的深連結錨點', () => {
    const { container } = render(<DatabaseSchemaSection />);
    const section = container.querySelector('#database');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('scroll-mt-20');
  });

  it('首次渲染顯示預設（資料表關聯）tab 的節點', () => {
    render(<DatabaseSchemaSection />);
    expect(screen.getByRole('button', { name: nodeButtonName('job') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: nodeButtonName('company') })).toBeInTheDocument();
  });

  it('點擊「物化視圖來源」tab 切換圖表並以 aria-pressed 反映選取狀態', async () => {
    const user = userEvent.setup();
    render(<DatabaseSchemaSection />);

    const toggle = screen.getByRole('group', { name: '切換分頁' });
    const mvButton = within(toggle).getByRole('button', { name: '物化視圖來源' });
    await user.click(mvButton);

    expect(mvButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: nodeButtonName('mv_job') })).toBeInTheDocument();
  });

  it('點擊「Function 讀寫」tab 顯示 function 節點', async () => {
    const user = userEvent.setup();
    render(<DatabaseSchemaSection />);

    const toggle = screen.getByRole('group', { name: '切換分頁' });
    await user.click(within(toggle).getByRole('button', { name: 'Function 讀寫' }));

    expect(screen.getByRole('button', { name: nodeButtonName('get_job_count') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: nodeButtonName('refresh_mv_job') })).toBeInTheDocument();
  });

  it('點擊節點開啟詳情面板並顯示其角色／說明', async () => {
    const user = userEvent.setup();
    render(<DatabaseSchemaSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('job') }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('職缺主表・所有分析的事實來源')).toBeInTheDocument();
  });

  it('切換 tab 時清除既有選取（詳情面板關閉）', async () => {
    const user = userEvent.setup();
    render(<DatabaseSchemaSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('job') }));
    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    const toggle = screen.getByRole('group', { name: '切換分頁' });
    await user.click(within(toggle).getByRole('button', { name: '物化視圖來源' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('按 Escape 收合詳情面板', async () => {
    const user = userEvent.setup();
    render(<DatabaseSchemaSection />);

    await user.click(screen.getByRole('button', { name: nodeButtonName('job') }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
