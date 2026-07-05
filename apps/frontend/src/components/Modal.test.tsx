import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <Modal open={false} title="公司詳細資訊" onClose={vi.fn()}>
        <p>內容</p>
      </Modal>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('公司詳細資訊')).not.toBeInTheDocument();
    expect(screen.queryByText('內容')).not.toBeInTheDocument();
  });

  it('renders the title and children when open is true', () => {
    render(
      <Modal open title="公司詳細資訊" onClose={vi.fn()}>
        <p>內容</p>
      </Modal>,
    );

    expect(screen.getByText('公司詳細資訊')).toBeInTheDocument();
    expect(screen.getByText('內容')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open title="公司詳細資訊" onClose={onClose}>
        <p>內容</p>
      </Modal>,
    );

    // The backdrop is the outer fixed overlay container, not the content panel.
    await user.click(screen.getByTestId('modal-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the content area is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open title="公司詳細資訊" onClose={onClose}>
        <p>內容</p>
      </Modal>,
    );

    await user.click(screen.getByText('內容'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open title="公司詳細資訊" onClose={onClose}>
        <p>內容</p>
      </Modal>,
    );

    await user.click(screen.getByLabelText('關閉'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
