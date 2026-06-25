import { useEffect, useRef } from 'react';

import type { CrawlerNode } from '../content/crawlerPipeline';

export interface CrawlerPipelineNodeDetailProps {
  readonly node: CrawlerNode | null;
  readonly onClose: () => void;
}

// 節點詳情面板：只顯示目前選取節點的 label 與 detail.role／detail.usage（內容已無機密）。
// 鍵盤與焦點行為：Escape 關閉、開啟時焦點移入面板，關閉時還原至開啟前的觸發元素。
export function CrawlerPipelineNodeDetail({ node, onClose }: CrawlerPipelineNodeDetailProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!node) return;

    previouslyFocused.current = document.activeElement;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const toRestore = previouslyFocused.current;
      if (toRestore instanceof HTMLElement) {
        toRestore.focus();
      }
    };
  }, [node, onClose]);

  if (!node) return null;

  return (
    <div
      role="dialog"
      aria-label={node.label}
      className="rounded-xl border border-[#c3c6d5] bg-white p-4 text-left shadow-2xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#e8eaf0] pb-2.5">
        <h3 className="text-base font-black tracking-tight text-[#001f2a]">{node.label}</h3>
        <button
          ref={closeButtonRef}
          type="button"
          className="-m-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9398a6] transition-colors hover:bg-[#f4faff] hover:text-[#001f2a]"
          aria-label="關閉說明"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            close
          </span>
        </button>
      </div>
      {node.detail && (
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-bold text-[#001f2a]">角色</dt>
            <dd className="mt-0.5 text-sm leading-relaxed font-normal text-[#5b6070]">{node.detail.role}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[#001f2a]">用途</dt>
            <dd className="mt-0.5 text-sm leading-relaxed font-normal text-[#5b6070]">{node.detail.usage}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
