import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { cloudArchitecture } from '../content/cloudArchitecture';
import { CloudArchNodeDetail } from './CloudArchNodeDetail';

const cfWorker = cloudArchitecture.nodes.find(n => n.id === 'cf-worker');
if (!cfWorker || !cfWorker.detail) {
  throw new Error('測試前置條件失敗：找不到含 detail 的 cf-worker 節點');
}
const node = cfWorker;
const detail = cfWorker.detail;

describe('CloudArchNodeDetail', () => {
  it('當 node 為 null 時不渲染任何內容', () => {
    const { container } = render(
      <CloudArchNodeDetail node={null} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('顯示節點 label、detail.role 與 detail.usage', () => {
    render(<CloudArchNodeDetail node={node} onClose={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: node.label }),
    ).toBeInTheDocument();
    expect(screen.getByText(detail.role)).toBeInTheDocument();
    expect(screen.getByText(detail.usage)).toBeInTheDocument();
  });

  it('detail 未定義時仍能優雅顯示 label 而不崩潰', () => {
    const bare = { ...node, detail: undefined };
    render(<CloudArchNodeDetail node={bare} onClose={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: bare.label }),
    ).toBeInTheDocument();
  });

  it('點擊關閉按鈕呼叫 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CloudArchNodeDetail node={node} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '關閉說明' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('按下 Escape 呼叫 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CloudArchNodeDetail node={node} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('開啟時焦點移入面板（關閉按鈕取得焦點）', () => {
    render(<CloudArchNodeDetail node={node} onClose={vi.fn()} />);
    const closeButton = screen.getByRole('button', { name: '關閉說明' });
    expect(document.activeElement).toBe(closeButton);
  });
});
