import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CloudArchitectureSection } from './CloudArchitectureSection';

const escapeRe = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 互動節點按鈕的無障礙名稱為 `${label} — ${statusWord}`。
const nodeButtonName = (label: string): RegExp =>
  new RegExp(`^${escapeRe(label)} —`);

describe('CloudArchitectureSection', () => {
  it('提供 id="cloud-architecture" 與 scroll-mt-20 的深連結錨點', () => {
    const { container } = render(<CloudArchitectureSection />);
    const section = container.querySelector('#cloud-architecture');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('scroll-mt-20');
  });

  it('首次渲染顯示預設（流量）視角的節點', () => {
    render(<CloudArchitectureSection />);
    expect(
      screen.getByRole('button', {
        name: nodeButtonName('Cloudflare Worker'),
      }),
    ).toBeInTheDocument();
  });

  it('點擊 CI/CD 視角切換圖表並以 aria-pressed 反映選取狀態', async () => {
    const user = userEvent.setup();
    render(<CloudArchitectureSection />);

    const toggle = screen.getByRole('group', { name: '切換視角' });
    const cicdButton = within(toggle).getByRole('button', {
      name: 'CI/CD 視角',
    });
    await user.click(cicdButton);

    expect(cicdButton).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: nodeButtonName('GitHub Repo') }),
    ).toBeInTheDocument();
  });

  it('點擊互動節點開啟詳情面板並顯示其角色／用途', async () => {
    const user = userEvent.setup();
    render(<CloudArchitectureSection />);

    await user.click(
      screen.getByRole('button', {
        name: nodeButtonName('Cloudflare Worker'),
      }),
    );

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('對外唯一入口與反向代理'),
    ).toBeInTheDocument();
  });

  it('切換視角時清除既有選取（詳情面板關閉）', async () => {
    const user = userEvent.setup();
    render(<CloudArchitectureSection />);

    await user.click(
      screen.getByRole('button', {
        name: nodeButtonName('Cloudflare Worker'),
      }),
    );
    expect(screen.queryByRole('dialog')).toBeInTheDocument();

    const toggle = screen.getByRole('group', { name: '切換視角' });
    await user.click(
      within(toggle).getByRole('button', { name: 'CI/CD 視角' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('文字摘要區一律存在於 DOM', () => {
    render(<CloudArchitectureSection />);
    expect(
      screen.getByRole('region', { name: '架構文字摘要' }),
    ).toBeInTheDocument();
  });

  it('視角切換按鈕具可見焦點樣式（focus-visible:ring-2）', () => {
    const { container } = render(<CloudArchitectureSection />);
    const toggle = container.querySelector('[aria-label="切換視角"]');
    expect(toggle).not.toBeNull();
    const button = within(toggle as HTMLElement).getByRole('button', {
      name: '流量視角',
    });
    expect(button.className).toContain('focus-visible:ring-2');
  });
});
